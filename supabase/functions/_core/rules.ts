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
  /** null = múltipla oficial; preenchido = desafio criado por usuário. */
  owner_id: string | null;
  titulo: string | null;
  convite: string | null;
  publico: boolean;
};

export type RankingRow = {
  posicao: number;
  user_id: string;
  nome: string;
  bairro: string;
  pontuacao: number;
  fichas_apostadas: number;
  /** Maior multiplicador que bateu (Simples ou Múltipla inteira). */
  maior_acerto: number;
  /** Bilhetes que bateram: cada Simples e cada Múltipla inteira contam 1. */
  acertos: number;
  /** Quando empata em pontos com o vizinho: o critério que decidiu. */
  desempate: string | null;
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
  owner_id: (r.owner_id as string) ?? null,
  titulo: (r.titulo as string) ?? null,
  convite: (r.convite as string) ?? null,
  publico: !!r.publico,
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
  const [row] = await db`select * from ligas where data = ${data} and owner_id is null`;
  return row ? mapLiga(row) : null;
}

/** Múltipla em vigor: a de hoje (mesmo finalizada, até virar o dia); senão, a próxima não finalizada. */
export async function getLigaAtual(db: Db, hoje: string): Promise<LigaRow | null> {
  const [row] = await db`
    select * from ligas
    where ((data >= ${hoje} and status <> 'finalizada') or data = ${hoje}) and owner_id is null
    order by (data = ${hoje}) desc, (status <> 'finalizada') desc, data
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

/** Fichas pra apostar: as iniciais + o que voltou dos acertos − o que já foi apostado (só inteiras). */
export async function fichasDisponiveis(db: Db, userId: string, ligaId: string) {
  const entrada = await getEntrada(db, userId, ligaId);
  if (!entrada) return 0;
  const [usadas, retornos] = await Promise.all([fichasUsadas(db, userId, ligaId), retornosPorUsuario(db, ligaId)]);
  return livresDe(entrada.fichas_total, retornos.get(userId) ?? 0, usadas);
}

export const livresDe = (total: number, retornos: number, usadas: number) =>
  Math.max(0, Math.floor(exato(total + retornos - usadas)));

/** Paga a entrada em PONTOS e recebe as FICHAS da liga. */
export async function entrarNaLiga(sql: Db, userId: string, ligaId: string) {
  return sql.begin(async (tx: Tx) => {
    const [user] = await tx`select id, saldo_pontos, ativado_em from users where id = ${userId} for update`;
    if (!user || !user.ativado_em) throw new RuleError('Usuário não encontrado.');
    const liga = await getLiga(tx, ligaId, 'for share');
    const custo = liga.custo_entrada;

    if (liga.status !== 'aberta') throw new RuleError('Esse palpite não está aberto para entrada.');
    const [futuro] = await tx`select 1 from jogos where liga_id = ${ligaId} and horario > now() limit 1`;
    if (!futuro) throw new RuleError('Todos os jogos dessa rodada já começaram.');
    if (await getEntrada(tx, userId, ligaId)) throw new RuleError('Você já está nesse palpite.');
    if ((liga as Record<string, unknown>).modo === 'duelo') {
      const [n] = await tx`select count(*)::int as n from entradas where liga_id = ${ligaId}`;
      if (num(n.n) >= 2) throw new RuleError('Esse duelo já está cheio.');
    }
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
export async function apostar(
  sql: Db,
  userId: string,
  ligaId: string,
  entrada: BilheteInput | Record<string, number>,
  opts: { editar?: boolean } = {},
) {
  const bilhete: BilheteInput =
    entrada && ('simples' in entrada || 'multiplas' in entrada)
      ? (entrada as BilheteInput)
      : { simples: entrada as Record<string, number> };
  const somaSimples = new Map<string, number>();
  for (const [id, f] of Object.entries(bilhete.simples ?? {})) {
    if (!(Number(f) > 0)) continue;
    if (!Number.isInteger(f)) throw new RuleError('Use apenas números inteiros de fichas.');
    const k = id.toLowerCase();
    somaSimples.set(k, (somaSimples.get(k) ?? 0) + f);
  }
  const simples = [...somaSimples.entries()];
  const brutas = Array.isArray(bilhete.multiplas) ? bilhete.multiplas : [];
  for (const m of brutas) {
    if (!m || !Array.isArray(m.mercados) || !m.mercados.every((id) => typeof id === 'string')) {
      throw new RuleError('Múltipla inválida.');
    }
  }
  const multiplas = brutas.map((m) => ({ ...m, mercados: m.mercados.map((id) => id.toLowerCase()) }));
  for (const m of multiplas) {
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
    if (opts.editar) {
      // Editar: refaz o que ainda não começou; o que já começou fica travado.
      await tx`
        delete from apostas a using mercados m, jogos j
        where a.mercado_id = m.id and j.id = m.jogo_id and a.user_id = ${userId}
          and j.liga_id = ${ligaId} and j.horario > now()`;
      await tx`
        delete from multiplas mu where mu.user_id = ${userId} and mu.liga_id = ${ligaId}
          and not exists (select 1 from multipla_pernas p join mercados m on m.id = p.mercado_id
                          join jogos j on j.id = m.jogo_id where p.multipla_id = mu.id and j.horario <= now())`;
    }
    if (simples.length === 0 && multiplas.length === 0) {
      if (opts.editar) return { fichas_distribuidas: 0, fichas_livres: await fichasDisponiveis(tx, userId, ligaId) };
      throw new RuleError('Distribua pelo menos 1 ficha.');
    }

    const ids = [...new Set([...simples.map(([id]) => id), ...multiplas.flatMap((m) => m.mercados)])];
    const mercados = ids.every(isUuid)
      ? await tx`
          select m.id, m.grupo, m.descricao, m.multiplicador, m.jogo_id, j.time_casa, j.time_fora,
                 j.horario <= now() as comecou
          from mercados m join jogos j on j.id = m.jogo_id
          where m.id in ${tx(ids)} and j.liga_id = ${ligaId} and m.oculto = false`
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
    const disponiveis = livresDe(
      ent.fichas_total,
      (await retornosPorUsuario(tx, ligaId)).get(userId) ?? 0,
      await fichasUsadas(tx, userId, ligaId),
    );
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

/**
 * Pontos: fichas ganhas nos acertos − as ganhas que foram reapostadas. As iniciais não contam
 * (nem as que sobraram) e são as primeiras a sair numa aposta. Sem arredondar.
 */
export async function pontosPorUsuario(db: Db, ligaId: string): Promise<Map<string, number>> {
  const [retornos, gastos] = await Promise.all([
    retornosPorUsuario(db, ligaId),
    db`
      select e.user_id, e.fichas_total,
        coalesce((select sum(a.fichas_apostadas) from apostas a join mercados m on m.id = a.mercado_id
                  join jogos j on j.id = m.jogo_id where a.user_id = e.user_id and j.liga_id = e.liga_id), 0)
        + coalesce((select sum(mu.fichas_apostadas) from multiplas mu
                    where mu.user_id = e.user_id and mu.liga_id = e.liga_id), 0) as usadas
      from entradas e where e.liga_id = ${ligaId}`,
  ]);
  const out = new Map<string, number>();
  for (const g of gastos) {
    const r = retornos.get(g.user_id as string);
    if (r == null) continue;
    out.set(g.user_id as string, exato(r - Math.max(0, num(g.usadas) - num(g.fichas_total))));
  }
  return out;
}

/** Fichas que voltaram: simples certas + múltiplas com todas as pernas certas. Sem arredondar. */
export async function retornosPorUsuario(db: Db, ligaId: string): Promise<Map<string, number>> {
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

/** Maior multiplicador acertado e nº de bilhetes certos (Múltipla inteira conta 1). */
async function acertosPorUsuario(db: Db, ligaId: string) {
  const [simples, pernas] = await Promise.all([
    db`
      select a.user_id, a.odd from apostas a join mercados m on m.id = a.mercado_id join jogos j on j.id = m.jogo_id
      where j.liga_id = ${ligaId} and m.resultado_final`,
    db`
      select mu.id, mu.user_id, p.odd, m.resultado_final
      from multiplas mu join multipla_pernas p on p.multipla_id = mu.id join mercados m on m.id = p.mercado_id
      where mu.liga_id = ${ligaId}`,
  ]);
  const out = new Map<string, { maior: number; n: number }>();
  const soma = (u: string, odd: number) => {
    const x = out.get(u) ?? { maior: 0, n: 0 };
    out.set(u, { maior: Math.max(x.maior, odd), n: x.n + 1 });
  };
  for (const a of simples) soma(a.user_id as string, num(a.odd));
  const mults = new Map<string, { user: string; odds: number[]; ok: boolean }>();
  for (const p of pernas) {
    const m = mults.get(p.id as string) ?? { user: p.user_id as string, odds: [], ok: true };
    m.odds.push(num(p.odd));
    m.ok &&= !!p.resultado_final;
    mults.set(p.id as string, m);
  }
  for (const m of mults.values()) if (m.ok) soma(m.user, oddTotal(m.odds));
  return out;
}

/**
 * Pontuação desc; empate → maior multiplicador acertado; depois mais bilhetes certos;
 * persistindo, a ordem entre eles é só técnica (id) e sem critério exibido.
 */
export async function calcularRanking(db: Db, ligaId: string): Promise<RankingRow[]> {
  const [rows, pontos, acertos] = await Promise.all([
    db`
      with ev as (
        select a.user_id, a.fichas_apostadas as f
        from apostas a join mercados m on m.id = a.mercado_id join jogos j on j.id = m.jogo_id
        where j.liga_id = ${ligaId}
        union all
        select user_id, fichas_apostadas from multiplas where liga_id = ${ligaId}
      )
      select u.id, u.nome, u.bairro,
             coalesce((select sum(ev.f) from ev where ev.user_id = e.user_id), 0)::int as fichas
      from entradas e join users u on u.id = e.user_id
      where e.liga_id = ${ligaId}`,
    pontosPorUsuario(db, ligaId),
    acertosPorUsuario(db, ligaId),
  ]);
  const lista = rows.map((r) => ({
    r,
    pontos: pontos.get(r.id as string) ?? 0,
    maior: acertos.get(r.id as string)?.maior ?? 0,
    n: acertos.get(r.id as string)?.n ?? 0,
  }));
  type L = (typeof lista)[number];
  const criterio = (a: L, b: L): string | null =>
    a.maior !== b.maior
      ? `maior multiplicador acertado: ${a.maior.toFixed(2)}`
      : a.n !== b.n
        ? `${a.n} ${a.n === 1 ? 'acerto' : 'acertos'}`
        : null;
  lista.sort(
    (a, b) =>
      b.pontos - a.pontos ||
      b.maior - a.maior ||
      b.n - a.n ||
      String(a.r.id).localeCompare(String(b.r.id)),
  );
  return lista.map((x, i) => {
    const prox = lista[i + 1];
    const ant = lista[i - 1];
    // Quem ficou na frente mostra o que o pôs à frente; o último do empate, o critério que o deixou atrás.
    const desempate =
      prox?.pontos === x.pontos
        ? criterio(x, prox)
        : ant?.pontos === x.pontos
          ? criterio(x, ant)
          : null;
    return {
      posicao: i + 1,
      user_id: x.r.id as string,
      nome: nomePublico(x.r.nome as string),
      bairro: x.r.bairro as string,
      pontuacao: x.pontos,
      fichas_apostadas: num(x.r.fichas),
      maior_acerto: x.maior,
      acertos: x.n,
      desempate,
    };
  });
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
      from jogos j where j.id = m.jogo_id and j.liga_id = ${ligaId}
        and m.decidido_em is null`;

    const palpiteiros = await contarPalpiteiros(tx, ligaId);
    // Desafio não tem prêmio nem voucher: a finalização só congela o ranking.
    const oficial = liga.owner_id == null;
    const premioFinal = oficial ? resolverPremio(await getEscada(tx), palpiteiros, await getPremioInicial(tx)) : null;
    await tx`
      update ligas set status = 'finalizada', premio_final = ${premioFinal}, finalizada_em = now()
      where id = ${ligaId}`;

    const ranking = await calcularRanking(tx, ligaId);
    const primeiro = ranking[0];
    let voucher: Voucher | null = null;
    if (oficial && primeiro && primeiro.pontuacao > 0) {
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
      const [u] = await tx`select saldo_pontos from users where id = ${v.user_id} for update`;
      if (num(u.saldo_pontos) < liga.custo_entrada) {
        throw new RuleError('O vencedor já gastou os PONTOS devolvidos na finalização. Não dá pra reativar.');
      }
      await tx`update users set saldo_pontos = saldo_pontos - ${liga.custo_entrada} where id = ${v.user_id}`;
    }
    await tx`delete from vouchers where liga_id = ${ligaId}`;
    await tx`
      update mercados m set resultado_final = false
      from jogos j where j.id = m.jogo_id and j.liga_id = ${ligaId} and m.decidido_em is null`;
    await tx`update ligas set status = 'aberta', premio_final = null, finalizada_em = null where id = ${ligaId}`;
    return { ok: true as const };
  });
}
