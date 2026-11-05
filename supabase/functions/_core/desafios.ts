import type { UserPublico } from './auth.ts';
import { gerarToken } from './crypto.ts';
import { type Db, num, type Tx } from './db.ts';
import { ForbiddenError, NotFoundError, RuleError } from './errors.ts';
import { calcularRanking, getLiga, type LigaRow } from './rules.ts';
import { getConfig, jogosComMercados, minhaSituacao, palpiteirosDaLiga } from './services.ts';
import { isUuid, nomePublico } from './validation.ts';

/**
 * DESAFIO = liga criada por usuário (owner_id preenchido; oficial: null). Reaproveita todo o
 * motor de ligas/jogos/mercados/entradas/apostas/ranking. Diferenças da múltipla oficial:
 * - entrada grátis (custo_entrada = 0): sem PONTOS, sem prêmio/voucher;
 * - `convite` = token do link de entrada; `publico` = aparece na listagem da aba;
 * - fecha sozinha quando todos os jogos têm placar (ver resultados.ts) ou pelo dono.
 */

const MAX_JOGOS = 10;
const MAX_MERCADOS = 15;

/** Liga validada como desafio (owner_id preenchido). */
export async function porId(db: Db, ligaId: string): Promise<LigaRow> {
  if (!isUuid(ligaId)) throw new NotFoundError('Desafio não encontrado.');
  const liga = await getLiga(db, ligaId);
  if (!liga.owner_id) throw new NotFoundError('Desafio não encontrado.');
  return liga;
}

const mapResumo = (r: Record<string, unknown>, userId: string) => ({
  id: r.id as string,
  titulo: (r.titulo as string) ?? null,
  dono: nomePublico(r.dono_nome as string),
  dono_id: r.owner_id as string,
  e_dono: r.owner_id === userId,
  publico: !!r.publico,
  convite: r.convite as string,
  data: r.data instanceof Date ? r.data.toISOString().slice(0, 10) : String(r.data),
  status: r.status as LigaRow['status'],
  fichas_por_entrada: num(r.fichas_por_entrada),
  palpiteiros: num(r.palpiteiros),
  jogos: num(r.jogos),
});

const RESUMO = `
  select l.*, u.nome as dono_nome,
         (select count(*)::int from entradas e where e.liga_id = l.id) as palpiteiros,
         (select count(*)::int from jogos j where j.liga_id = l.id) as jogos
  from ligas l join users u on u.id = l.owner_id`;

/** Desafios que eu criei ou entrei + os públicos abertos/em andamento. */
export async function meusDesafios(db: Db, userId: string) {
  const [meus, publicos] = await Promise.all([
    db.unsafe(
      `${RESUMO}
       where l.owner_id = $1
          or exists (select 1 from entradas e where e.liga_id = l.id and e.user_id = $1)
       order by l.created_at desc`,
      [userId],
    ),
    db.unsafe(
      `${RESUMO}
       where l.publico and l.status <> 'finalizada'
         and l.owner_id <> $1
         and not exists (select 1 from entradas e where e.liga_id = l.id and e.user_id = $1)
       order by l.created_at desc limit 30`,
      [userId],
    ),
  ]);
  return {
    meus: meus.map((r) => mapResumo(r, userId)),
    publicos: publicos.map((r) => mapResumo(r, userId)),
  };
}

type MercadoInput = { grupo?: string; descricao: string; multiplicador: number };

function validarMercados(raw: unknown, jogo: string): MercadoInput[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new RuleError(`Escolha os mercados de ${jogo}.`);
  if (raw.length > MAX_MERCADOS) throw new RuleError(`Máximo de ${MAX_MERCADOS} mercados por jogo.`);
  return raw.map((m, i) => {
    const descricao = String(m?.descricao ?? '').trim();
    if (descricao.length < 1 || descricao.length > 80) throw new RuleError(`Mercado ${i + 1} de ${jogo}: descrição inválida.`);
    const multiplicador = Number(m?.multiplicador);
    if (!Number.isFinite(multiplicador) || multiplicador <= 0 || multiplicador > 999.99) {
      throw new RuleError(`Mercado "${descricao}": multiplicador inválido.`);
    }
    const grupo = String(m?.grupo ?? '').trim().slice(0, 40);
    return { grupo, descricao, multiplicador };
  });
}

/** Cria o desafio com jogos do pool e mercados escolhidos/sugeridos. O dono já entra. */
export async function criarDesafio(sql: Db, user: UserPublico, input: Record<string, unknown>) {
  const titulo = input.titulo == null ? null : String(input.titulo).trim();
  if (titulo !== null && (titulo.length < 1 || titulo.length > 60)) throw new RuleError('Título de até 60 caracteres.');
  const publico = !!input.publico;
  if (!Array.isArray(input.jogos)) throw new RuleError('Escolha os jogos do desafio.');
  const jogosIn = input.jogos as { fixture_id?: unknown; mercados?: unknown }[];
  if (jogosIn.length === 0 || jogosIn.length > MAX_JOGOS) throw new RuleError(`Escolha de 1 a ${MAX_JOGOS} jogos.`);
  const fixtureIds = jogosIn.map((j) => Number(j.fixture_id));
  if (fixtureIds.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(fixtureIds).size !== fixtureIds.length) {
    throw new RuleError('Jogos inválidos ou repetidos.');
  }

  return sql.begin(async (tx: Tx) => {
    const pool = await tx`select * from fixtures_dia where fixture_id in ${tx(fixtureIds)} order by horario, time_casa`;
    if (pool.length !== fixtureIds.length) throw new RuleError('Jogo fora do pool disponível.');
    const config = await getConfig(tx);
    const data = pool.map((f) => (f.data instanceof Date ? f.data.toISOString() : String(f.data)).slice(0, 10)).sort()[0];

    const [liga] = await tx`
      insert into ligas (data, owner_id, titulo, convite, publico, custo_entrada, fichas_por_entrada)
      values (${data}, ${user.id}, ${titulo}, ${gerarToken().slice(0, 12)}, ${publico}, 0, ${config.fichas_por_entrada})
      returning id`;
    const ligaId = liga.id as string;

    for (const [i, f] of pool.entries()) {
      const escolhido = jogosIn.find((j) => Number(j.fixture_id) === Number(f.fixture_id))!;
      const jogo = `${f.time_casa} x ${f.time_fora}`;
      const mercados = validarMercados(escolhido.mercados, jogo);
      const [j] = await tx`
        insert into jogos (liga_id, fixture_id, time_casa, time_fora, horario, campeonato, ordem)
        values (${ligaId}, ${f.fixture_id}, ${f.time_casa}, ${f.time_fora}, ${f.horario}, ${f.campeonato}, ${i})
        returning id`;
      await tx`insert into mercados ${tx(
        mercados.map((m, ordem) => ({ jogo_id: j.id, grupo: m.grupo, descricao: m.descricao, multiplicador: m.multiplicador, ordem })),
        'jogo_id', 'grupo', 'descricao', 'multiplicador', 'ordem',
      )}`;
    }

    // O dono já entra no próprio desafio (grátis).
    await tx`
      insert into entradas (user_id, liga_id, pontos_pagos, fichas_total)
      values (${user.id}, ${ligaId}, 0, ${config.fichas_por_entrada})`;

    const [criada] = await tx`select convite from ligas where id = ${ligaId}`;
    return { id: ligaId, convite: criada.convite as string };
  });
}

/** Prévia pública do convite (antes de entrar). */
export async function conviteView(db: Db, token: string) {
  const [r] = await db`
    select l.*, u.nome as dono_nome,
           (select count(*)::int from entradas e where e.liga_id = l.id) as palpiteiros,
           (select count(*)::int from jogos j where j.liga_id = l.id) as jogos
    from ligas l join users u on u.id = l.owner_id where l.convite = ${String(token)}`;
  if (!r) throw new NotFoundError('Convite inválido ou expirado.');
  return { desafio: mapResumo(r, '') };
}

/** Detalhe completo: jogos+mercados, minha situação, ranking. Privado: só quem entrou. */
export async function detalhe(db: Db, user: UserPublico | null, ligaId: string) {
  const liga = await porId(db, ligaId);
  const entrada = user ? await db`select 1 from entradas where liga_id = ${liga.id} and user_id = ${user.id}` : [];
  const entrou = entrada.length > 0;
  if (!liga.publico && !entrou && liga.owner_id !== user?.id) {
    throw new ForbiddenError('Esse desafio é privado. Entre pelo link de convite.');
  }
  const [jogos, eu, dono, palpiteiros] = await Promise.all([
    jogosComMercados(db, liga.id, user?.id),
    user && entrou ? minhaSituacao(db, user.id, liga) : Promise.resolve(user ? { entrou: false as const } : null),
    db`select nome from users where id = ${liga.owner_id}`,
    db`select count(*)::int as n from entradas where liga_id = ${liga.id}`,
  ]);
  return {
    liga: {
      id: liga.id,
      titulo: liga.titulo,
      dono: dono.length ? nomePublico(dono[0].nome as string) : '',
      e_dono: liga.owner_id === user?.id,
      publico: liga.publico,
      convite: liga.convite,
      data: liga.data,
      status: liga.status,
      fichas_por_entrada: liga.fichas_por_entrada,
    },
    jogos,
    eu,
    palpiteiros: num(palpiteiros[0].n),
    ranking: await calcularRanking(db, liga.id),
  };
}

/** Bilhetes de todo mundo (mesma visão da aba Ranking, por liga). */
export async function palpiteiros(db: Db, user: UserPublico | null, ligaId: string) {
  const liga = await porId(db, ligaId);
  return palpiteirosDaLiga(db, user, liga);
}

/** O dono fecha o desafio: mercados não apurados contam como perdidos. Sem prêmio/voucher. */
export async function finalizar(sql: Db, user: UserPublico, ligaId: string) {
  return sql.begin(async (tx: Tx) => {
    if (!isUuid(ligaId)) throw new NotFoundError('Desafio não encontrado.');
    const liga = await getLiga(tx, ligaId, 'for update');
    if (!liga.owner_id) throw new NotFoundError('Desafio não encontrado.');
    if (liga.owner_id !== user.id) throw new ForbiddenError('Só o dono do desafio pode finalizar.');
    if (liga.status === 'finalizada') throw new RuleError('Desafio já finalizado.');
    await tx`
      update mercados m set resultado_final = false
      from jogos j where j.id = m.jogo_id and j.liga_id = ${ligaId} and m.decidido_em is null`;
    await tx`update ligas set status = 'finalizada', finalizada_em = now() where id = ${ligaId}`;
    return { ranking: await calcularRanking(tx, ligaId) };
  });
}
