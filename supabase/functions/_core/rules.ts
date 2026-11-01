import { exato, incompativeis, oddTotal } from './compat.ts';
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
 * - Bilhete: Simples (`apostas`, fichas por palpite) e Múltiplas (`multiplas`, um valor só × produto das odds).
 *   A odd fica travada na confirmação.
 * - Pontuação = simples certas (fichas × odd) + múltiplas com todas as pernas certas (fichas × odd1 × odd2…).
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

export async function getPremioInicial(db: Db) {
  const [c] = await db`select premio_inicial from config where id = 1`;
  return num(c?.premio_inicial ?? 0);
}

export async function contarPalpiteiros(db: Db, ligaId: string) {
  const [r] = await db`select count(*)::int as n from entradas where liga_id = ${ligaId}`;
  return num(r.n);
}

export async function fichasUsadas(db: Db, userId: string, ligaId: string) {
  const [r] = await db`
    select
      coalesce((select sum(a.fichas_apostadas) from apostas a join mercados m on m.id = a.mercado_id
                join jogos j on j.id = m.jogo_id where a.user_id = ${userId} and j.liga_id = ${ligaId}), 0)::int
      + coalesce((select sum(fichas_apostadas) from multiplas where user_id = ${userId} and liga_id = ${ligaId}), 0)::int
      as total`;
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

export type MultiplaInput = { mercados: string[]; fichas: number };
export type BilheteInput = { simples?: Record<string, number>; multiplas?: MultiplaInput[] };

const chaveMultipla = (ids: string[]) => [...ids].sort().join(',');

/**
 * Confirma um bilhete: Simples (fichas por palpite) e Múltiplas (um valor só, mínimo 2 palpites,
 * sem palpites incompatíveis do mesmo jogo, sem repetir uma múltipla igual). Aceita também o formato
 * antigo `{ mercadoId: fichas }`, tratado como Simples. Não toca em PONTOS.
 */
export async function apostar(sql: Db, userId: string, ligaId: string, entrada: BilheteInput | Record<string, number>) {
  const bilhete: BilheteInput =
    entrada && ('simples' in entrada || 'multiplas' in entrada)
      ? (entrada as BilheteInput)
      : { simples: entrada as Record<string, number> };
  const simples = Object.entries(bilhete.simples ?? {}).filter(([, f]) => Number(f) > 0);
  const multiplas = Array.isArray(bilhete.multiplas) ? bilhete.multiplas : [];
  for (const [, fichas] of simples) {
    if (!Number.isInteger(fichas)) throw new RuleError('Use apenas números inteiros de fichas.');
  }
  for (const m of multiplas) {
    if (!m || !Array.isArray(m.mercados) || !m.mercados.every((id) => typeof id === 'string')) {
      throw new RuleError('Múltipla inválida.');
    }
    if (!Number.isInteger(m.fichas) || m.fichas <= 0) throw new RuleError('Coloque fichas em cada múltipla.');
    if (new Set(m.mercados).size !== m.mercados.length) throw new RuleError('Palpite repetido na mesma múltipla.');
    if (m.mercados.length < 2) throw new RuleError('Múltipla precisa de pelo menos 2 palpites.');
  }
  const chaves = multiplas.map((m) => chaveMultipla(m.mercados));
  if (new Set(chaves).size !== chaves.length) throw new RuleError('Você montou duas múltiplas iguais.');

  return sql.begin(async (tx: Tx) => {
    const liga = await getLiga(tx, ligaId, 'for share');
    if (liga.status !== 'aberta') throw new RuleError('Apostas encerradas para esse palpite.');
    // Trava a entrada para serializar distribuições simultâneas do mesmo usuário.
    const ent = await getEntrada(tx, userId, ligaId, true);
    if (!ent) throw new RuleError('Entre no palpite antes de distribuir fichas.');
    if (simples.length === 0 && multiplas.length === 0) throw new RuleError('Distribua pelo menos 1 ficha.');

    const ids = [...new Set([...simples.map(([id]) => id), ...multiplas.flatMap((m) => m.mercados)])];
    const mercados = ids.every(isUuid)
      ? await tx`
          select m.id, m.grupo, m.descricao, m.multiplicador, m.jogo_id, j.time_casa, j.time_fora,
                 j.horario <= now() as comecou
          from mercados m join jogos j on j.id = m.jogo_id
          where m.id in ${tx(ids)} and j.liga_id = ${ligaId}`
      : [];
    if (mercados.length !== ids.length) throw new RuleError('Mercado inválido para esse palpite.');
    if (mercados.some((m) => m.comecou)) throw new RuleError('Esse jogo já começou. Apostas encerradas para ele.');
    const porId = new Map(
      mercados.map((m) => [
        m.id as string,
        {
          jogo_id: m.jogo_id as string,
          time_casa: m.time_casa as string,
          time_fora: m.time_fora as string,
          grupo: (m.grupo as string) ?? '',
          descricao: m.descricao as string,
          odd: num(m.multiplicador),
        },
      ]),
    );

    for (const m of multiplas) {
      const ops = m.mercados.map((id) => porId.get(id)!);
      for (let i = 0; i < ops.length; i++) {
        for (let k = i + 1; k < ops.length; k++) {
          if (incompativeis(ops[i], ops[k])) throw new RuleError('Evento incompatível na múltipla.');
        }
      }
    }
    if (multiplas.length) {
      const existentes = await tx`
        select string_agg(p.mercado_id::text, ',' order by p.mercado_id::text) as chave
        from multiplas mu join multipla_pernas p on p.multipla_id = mu.id
        where mu.user_id = ${userId} and mu.liga_id = ${ligaId} group by mu.id`;
      const ja = new Set(existentes.map((e) => e.chave as string));
      if (chaves.some((c) => ja.has(c))) throw new RuleError('Você já tem uma múltipla igual a essa.');
    }

    const total = simples.reduce((s, [, f]) => s + f, 0) + multiplas.reduce((s, m) => s + m.fichas, 0);
    const disponiveis = ent.fichas_total - (await fichasUsadas(tx, userId, ligaId));
    if (total > disponiveis) {
      throw new RuleError(`Você tem ${disponiveis} fichas livres e tentou distribuir ${total}.`);
    }

    if (simples.length) {
      const rows = simples.map(([mercado_id, fichas_apostadas]) => ({
        user_id: userId,
        mercado_id,
        fichas_apostadas,
        odd: porId.get(mercado_id)!.odd,
      }));
      await tx`insert into apostas ${tx(rows, 'user_id', 'mercado_id', 'fichas_apostadas', 'odd')}`;
    }
    for (const m of multiplas) {
      const [mu] = await tx`
        insert into multiplas (user_id, liga_id, fichas_apostadas) values (${userId}, ${ligaId}, ${m.fichas})
        returning id`;
      const pernas = m.mercados.map((mercado_id) => ({ multipla_id: mu.id, mercado_id, odd: porId.get(mercado_id)!.odd }));
      await tx`insert into multipla_pernas ${tx(pernas, 'multipla_id', 'mercado_id', 'odd')}`;
    }
    return { fichas_distribuidas: total, fichas_livres: disponiveis - total };
  });
}

/** Pontos de cada usuário na liga: simples certas + múltiplas com todas as pernas certas. Sem arredondar. */
export async function pontosPorUsuario(db: Db, ligaId: string): Promise<Map<string, number>> {
  const [simples, pernas] = await Promise.all([
    db`
      select a.user_id, sum(a.fichas_apostadas * a.odd) as pontos
      from apostas a join mercados m on m.id = a.mercado_id join jogos j on j.id = m.jogo_id
      where j.liga_id = ${ligaId} and m.resultado_final group by a.user_id`,
    db`
      select mu.id, mu.user_id, mu.fichas_apostadas, p.odd, m.resultado_final
      from multiplas mu join multipla_pernas p on p.multipla_id = mu.id join mercados m on m.id = p.mercado_id
      where mu.liga_id = ${ligaId}`,
  ]);
  const out = new Map<string, number>();
  for (const r of simples) out.set(r.user_id as string, num(r.pontos));
  const mults = new Map<string, { user: string; fichas: number; odds: number[]; ok: boolean }>();
  for (const p of pernas) {
    const m = mults.get(p.id as string) ?? { user: p.user_id as string, fichas: num(p.fichas_apostadas), odds: [], ok: true };
    m.odds.push(num(p.odd));
    m.ok &&= !!p.resultado_final;
    mults.set(p.id as string, m);
  }
  for (const m of mults.values()) {
    if (m.ok) out.set(m.user, (out.get(m.user) ?? 0) + m.fichas * oddTotal(m.odds));
  }
  for (const [k, v] of out) out.set(k, exato(v));
  return out;
}

export async function pontuacaoUsuario(db: Db, userId: string, ligaId: string) {
  return (await pontosPorUsuario(db, ligaId)).get(userId) ?? 0;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pontuação desc; empate → primeira aposta (timestamp µs) asc; persistindo → users.created_at asc. */
export async function calcularRanking(db: Db, ligaId: string): Promise<RankingRow[]> {
  const [rows, pontos] = await Promise.all([
    db`
      with ev as (
        select a.user_id, a.fichas_apostadas as f, a.created_at as c
        from apostas a join mercados m on m.id = a.mercado_id join jogos j on j.id = m.jogo_id
        where j.liga_id = ${ligaId}
        union all
        select user_id, fichas_apostadas, created_at from multiplas where liga_id = ${ligaId}
      )
      select u.id, u.nome, u.bairro, coalesce(sum(ev.f), 0)::int as fichas, min(ev.c) as primeira,
             (extract(epoch from min(ev.c)) * 1000000)::bigint::text as primeira_us,
             (extract(epoch from u.created_at) * 1000000)::bigint::text as criado_us
      from entradas e
      join users u on u.id = e.user_id
      left join ev on ev.user_id = e.user_id
      where e.liga_id = ${ligaId}
      group by u.id`,
    pontosPorUsuario(db, ligaId),
  ]);
  const big = (v: unknown) => (v == null ? null : BigInt(v as string));
  const cmp = (a: bigint | null, b: bigint | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);
  const lista = rows.map((r) => ({
    r,
    pontos: pontos.get(r.id as string) ?? 0,
    primeira: big(r.primeira_us),
    criado: big(r.criado_us)!,
  }));
  lista.sort(
    (a, b) =>
      b.pontos - a.pontos ||
      cmp(a.primeira, b.primeira) ||
      cmp(a.criado, b.criado) ||
      String(a.r.id).localeCompare(String(b.r.id)),
  );
  return lista.map(({ r, pontos: p }, i) => ({
    posicao: i + 1,
    user_id: r.id as string,
    nome: nomePublico(r.nome as string),
    bairro: r.bairro as string,
    pontuacao: p,
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
    const premioFinal = resolverPremio(await getEscada(tx), palpiteiros, await getPremioInicial(tx));
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
