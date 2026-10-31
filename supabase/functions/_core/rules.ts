import { gerarCodigoVoucher } from './crypto.ts';
import { type Db, iso, num, type Tx } from './db.ts';
import { NotFoundError, RuleError } from './errors.ts';
import { type Faixa, resolverPremio } from './premio.ts';
import { isUuid, nomePublico } from './validation.ts';

/**
 * REGRA DE OURO (portada de mobile/src/lib/rules.ts)
 * - PONTOS = saldo do perfil (users.saldo_pontos), vive FORA da liga.
 * - FICHAS = só existem DENTRO da liga (a múltipla do dia). Entrar custa `custo_entrada` PONTOS e dá
 *   `fichas_por_entrada` FICHAS.
 * - Apostar distribui FICHAS em mercados de qualquer jogo da liga e NUNCA mexe em saldo_pontos.
 * - Pontuação = SUM(fichas_apostadas * multiplicador) WHERE mercados.resultado_final = true.
 * - Ranking: pontuação desc; empate → quem apostou primeiro; persistindo → users.created_at.
 */

export type LigaRow = {
  id: string;
  data: string;
  premio_desc: string | null;
  premio_final: number | null;
  status: 'aberta' | 'em_andamento' | 'finalizada';
  custo_entrada: number;
  fichas_por_entrada: number;
};

export type RankingRow = {
  posicao: number;
  user_id: string;
  nome: string;
  bairro: string;
  pontuacao: number;
  fichas_apostadas: number;
  primeira_aposta_em: string | null;
};

export type Voucher = { id: string; liga_id: string; user_id: string; codigo: string; valor: number; resgatado: boolean };

const mapLiga = (r: Record<string, unknown>): LigaRow => ({
  id: r.id as string,
  data: r.data instanceof Date ? r.data.toISOString().slice(0, 10) : String(r.data),
  premio_desc: (r.premio_desc as string) ?? null,
  premio_final: r.premio_final == null ? null : num(r.premio_final),
  status: r.status as LigaRow['status'],
  custo_entrada: num(r.custo_entrada),
  fichas_por_entrada: num(r.fichas_por_entrada),
});

export async function getLiga(db: Db, ligaId: string, lock: '' | 'for update' | 'for share' = ''): Promise<LigaRow> {
  if (!isUuid(ligaId)) throw new NotFoundError('Palpite não encontrado.');
  const [row] =
    lock === 'for update'
      ? await db`select * from ligas where id = ${ligaId} for update`
      : lock === 'for share'
        ? await db`select * from ligas where id = ${ligaId} for share`
        : await db`select * from ligas where id = ${ligaId}`;
  if (!row) throw new NotFoundError('Palpite não encontrado.');
  return mapLiga(row);
}

export async function getLigaPorData(db: Db, data: string): Promise<LigaRow | null> {
  const [row] = await db`select * from ligas where data = ${data}`;
  return row ? mapLiga(row) : null;
}

/** Múltipla em vigor: a próxima ainda não finalizada a partir de hoje; senão, a de hoje. */
export async function getLigaAtual(db: Db, hoje: string): Promise<LigaRow | null> {
  const [row] = await db`
    select * from ligas
    where (data >= ${hoje} and status <> 'finalizada') or data = ${hoje}
    order by (status <> 'finalizada') desc, data
    limit 1`;
  return row ? mapLiga(row) : null;
}

export async function getEscada(db: Db): Promise<Faixa[]> {
  const rows = await db`select ordem, usuarios_min, valor from premio_escada order by ordem`;
  return rows.map((r) => ({ ordem: num(r.ordem), usuarios_min: num(r.usuarios_min), valor: num(r.valor) }));
}

export async function contarPalpiteiros(db: Db, ligaId: string) {
  const [r] = await db`select count(*)::int as n from entradas where liga_id = ${ligaId}`;
  return num(r.n);
}

export async function fichasUsadas(db: Db, userId: string, ligaId: string) {
  const [r] = await db`
    select coalesce(sum(a.fichas_apostadas), 0)::int as total
    from apostas a join mercados m on m.id = a.mercado_id join jogos j on j.id = m.jogo_id
    where a.user_id = ${userId} and j.liga_id = ${ligaId}`;
  return num(r.total);
}

export async function getEntrada(db: Db, userId: string, ligaId: string, lock = false) {
  const [e] = lock
    ? await db`select * from entradas where user_id = ${userId} and liga_id = ${ligaId} for update`
    : await db`select * from entradas where user_id = ${userId} and liga_id = ${ligaId}`;
  return e ? { id: e.id as string, fichas_total: num(e.fichas_total), pontos_pagos: num(e.pontos_pagos), created_at: iso(e.created_at)! } : null;
}

export async function fichasDisponiveis(db: Db, userId: string, ligaId: string) {
  const entrada = await getEntrada(db, userId, ligaId);
  if (!entrada) return 0;
  return Math.max(0, entrada.fichas_total - (await fichasUsadas(db, userId, ligaId)));
}

/** Paga a entrada em PONTOS e recebe as FICHAS da liga. */
export async function entrarNaLiga(sql: Db, userId: string, ligaId: string) {
  return sql.begin(async (tx: Tx) => {
    const [user] = await tx`select id, saldo_pontos, ativado_em from users where id = ${userId} for update`;
    if (!user || !user.ativado_em) throw new RuleError('Usuário não encontrado.');
    const liga = await getLiga(tx, ligaId, 'for share');
    const custo = liga.custo_entrada;

    if (liga.status !== 'aberta') throw new RuleError('Esse palpite não está aberto para entrada.');
    if (await getEntrada(tx, userId, ligaId)) throw new RuleError('Você já está nesse palpite.');
    if (num(user.saldo_pontos) < custo) throw new RuleError(`Saldo insuficiente. Você precisa de ${custo} PONTOS.`);

    await tx`update users set saldo_pontos = saldo_pontos - ${custo} where id = ${userId}`;
    const [e] = await tx`
      insert into entradas (user_id, liga_id, pontos_pagos, fichas_total)
      values (${userId}, ${ligaId}, ${custo}, ${liga.fichas_por_entrada})
      on conflict (user_id, liga_id) do nothing
      returning id, fichas_total, created_at`;
    if (!e) throw new RuleError('Você já está nesse palpite.');
    return { entrada_id: e.id as string, fichas_total: num(e.fichas_total), saldo_pontos: num(user.saldo_pontos) - custo };
  });
}

/** Distribui FICHAS nos mercados (de qualquer jogo da liga). 1 registro em `apostas` por mercado. Não toca em PONTOS. */
export async function apostar(sql: Db, userId: string, ligaId: string, distribuicao: Record<string, number>) {
  const itens = Object.entries(distribuicao ?? {}).filter(([, f]) => Number(f) > 0);
  for (const [, fichas] of itens) {
    if (!Number.isInteger(fichas)) throw new RuleError('Use apenas números inteiros de fichas.');
  }

  return sql.begin(async (tx: Tx) => {
    const liga = await getLiga(tx, ligaId, 'for share');
    if (liga.status !== 'aberta') throw new RuleError('Apostas encerradas para esse palpite.');
    // Trava a entrada para serializar distribuições simultâneas do mesmo usuário.
    const entrada = await getEntrada(tx, userId, ligaId, true);
    if (!entrada) throw new RuleError('Entre no palpite antes de distribuir fichas.');
    if (itens.length === 0) throw new RuleError('Distribua pelo menos 1 ficha.');

    const ids = itens.map(([id]) => id);
    const uuidOk = ids.every(isUuid);
    const mercados = uuidOk
      ? await tx`
          select m.id, j.horario <= now() as comecou
          from mercados m join jogos j on j.id = m.jogo_id
          where m.id in ${tx(ids)} and j.liga_id = ${ligaId}`
      : [];
    if (mercados.length !== ids.length) throw new RuleError('Mercado inválido para esse palpite.');
    if (mercados.some((m) => m.comecou)) throw new RuleError('Esse jogo já começou. Apostas encerradas para ele.');

    const total = itens.reduce((s, [, f]) => s + f, 0);
    const disponiveis = entrada.fichas_total - (await fichasUsadas(tx, userId, ligaId));
    if (total > disponiveis) {
      throw new RuleError(`Você tem ${disponiveis} fichas livres e tentou distribuir ${total}.`);
    }

    const rows = itens.map(([mercado_id, fichas_apostadas]) => ({ user_id: userId, mercado_id, fichas_apostadas }));
    await tx`insert into apostas ${tx(rows, 'user_id', 'mercado_id', 'fichas_apostadas')}`;
    return { fichas_distribuidas: total, fichas_livres: disponiveis - total };
  });
}

export async function pontuacaoUsuario(db: Db, userId: string, ligaId: string) {
  const [r] = await db`
    select coalesce(sum(a.fichas_apostadas * m.multiplicador), 0) as total
    from apostas a join mercados m on m.id = a.mercado_id join jogos j on j.id = m.jogo_id
    where a.user_id = ${userId} and j.liga_id = ${ligaId} and m.resultado_final`;
  return round2(num(r.total));
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pontuação desc; empate → primeira aposta (timestamp µs) asc; persistindo → users.created_at asc. */
export async function calcularRanking(db: Db, ligaId: string): Promise<RankingRow[]> {
  const rows = await db`
    with ap as (
      select a.user_id,
             sum(a.fichas_apostadas)::int as fichas,
             sum(case when m.resultado_final then a.fichas_apostadas * m.multiplicador else 0 end) as pontos,
             min(a.created_at) as primeira
      from apostas a join mercados m on m.id = a.mercado_id join jogos j on j.id = m.jogo_id
      where j.liga_id = ${ligaId}
      group by a.user_id
    )
    select u.id, u.nome, u.bairro,
           coalesce(ap.pontos, 0) as pontos, coalesce(ap.fichas, 0) as fichas, ap.primeira
    from entradas e
    join users u on u.id = e.user_id
    left join ap on ap.user_id = e.user_id
    where e.liga_id = ${ligaId}
    order by coalesce(ap.pontos, 0) desc, ap.primeira asc nulls last, u.created_at asc, u.id`;
  return rows.map((r, i) => ({
    posicao: i + 1,
    user_id: r.id as string,
    nome: nomePublico(r.nome as string),
    bairro: r.bairro as string,
    pontuacao: round2(num(r.pontos)),
    fichas_apostadas: num(r.fichas),
    primeira_aposta_em: iso(r.primeira),
  }));
}

/**
 * Marca os mercados vencedores, fecha a liga e grava `premio_final` (faixa da escada atingida pelo nº de
 * palpiteiros, limitada à meta). O 1º lugar recebe de volta os PONTOS da entrada e um voucher com o valor
 * do prêmio. Se ninguém pontuou, não há vencedor.
 */
export async function finalizarLiga(sql: Db, ligaId: string, mercadosVencedores: string[]) {
  return sql.begin(async (tx: Tx) => {
    const liga = await getLiga(tx, ligaId, 'for update');
    if (liga.status === 'finalizada') throw new RuleError('Palpite já finalizado.');

    const vencedores = [...new Set(mercadosVencedores ?? [])];
    const doLiga = await tx`select m.id from mercados m join jogos j on j.id = m.jogo_id where j.liga_id = ${ligaId}`;
    const idsLiga = new Set(doLiga.map((m) => m.id as string));
    if (vencedores.some((id) => !idsLiga.has(id))) throw new RuleError('Mercado inválido para esse palpite.');

    await tx`
      update mercados m set resultado_final = (m.id = any(${vencedores}::uuid[]))
      from jogos j where j.id = m.jogo_id and j.liga_id = ${ligaId}`;

    const palpiteiros = await contarPalpiteiros(tx, ligaId);
    const premioFinal = resolverPremio(await getEscada(tx), palpiteiros);
    await tx`
      update ligas set status = 'finalizada', premio_final = ${premioFinal}, finalizada_em = now()
      where id = ${ligaId}`;

    const ranking = await calcularRanking(tx, ligaId);
    const primeiro = ranking[0];
    let voucher: Voucher | null = null;
    if (primeiro && primeiro.pontuacao > 0) {
      const [v] = await tx`
        insert into vouchers (liga_id, user_id, codigo, valor)
        values (${ligaId}, ${primeiro.user_id}, ${gerarCodigoVoucher()}, ${premioFinal})
        returning *`;
      await tx`update users set saldo_pontos = saldo_pontos + ${liga.custo_entrada} where id = ${primeiro.user_id}`;
      voucher = {
        id: v.id as string,
        liga_id: ligaId,
        user_id: primeiro.user_id,
        codigo: v.codigo as string,
        valor: num(v.valor),
        resgatado: v.resgatado as boolean,
      };
    }
    return { ranking, voucher, premio_final: premioFinal, palpiteiros };
  });
}

/**
 * Desfaz uma finalização (ex.: fechada por engano): apaga os vouchers, retira os PONTOS devolvidos ao
 * vencedor, limpa os resultados e reabre a liga. Bloqueado se algum voucher já foi resgatado.
 */
export async function reativarLiga(sql: Db, ligaId: string) {
  return sql.begin(async (tx: Tx) => {
    const liga = await getLiga(tx, ligaId, 'for update');
    if (liga.status !== 'finalizada') throw new RuleError('Esse palpite não está finalizado.');
    const vouchers = await tx`select user_id, resgatado from vouchers where liga_id = ${ligaId} for update`;
    if (vouchers.some((v) => v.resgatado)) throw new RuleError('O voucher desse palpite já foi resgatado.');
    for (const v of vouchers) {
      await tx`update users set saldo_pontos = greatest(0, saldo_pontos - ${liga.custo_entrada}) where id = ${v.user_id}`;
    }
    await tx`delete from vouchers where liga_id = ${ligaId}`;
    await tx`
      update mercados m set resultado_final = false
      from jogos j where j.id = m.jogo_id and j.liga_id = ${ligaId}`;
    await tx`update ligas set status = 'aberta', premio_final = null, finalizada_em = null where id = ${ligaId}`;
    return { ok: true as const };
  });
}
