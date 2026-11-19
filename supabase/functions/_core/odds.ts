import type { Db } from './db.ts';
import { RuleError } from './errors.ts';
import { nomeBR } from './times.ts';
import { validarDataISO } from './validation.ts';

/**
 * Integração com a OddsPapi v4 (api.oddspapi.io/v4) — única fonte de jogos, odds e placar.
 * As odds vêm de uma casa só (1xBet por padrão). Custo de requests:
 * - jogos do dia = 1 request por campeonato configurado;
 * - odds = 1 request por jogo, sob demanda (cache em fixtures_dia.mercados_sugeridos);
 * - catálogo de mercados = 1 request por isolate;
 * - placar = 1 request por jogo pendente (ver resultados.ts).
 * Os mercados que o placar resolve (resultado, gols, ambos marcam, handicap, 1º tempo) batem
 * sozinhos; os demais (jogador, escanteios, cartões, placar exato...) o admin liquida na mão.
 */
export type OddsConfig = { apiKey: string; bookmaker?: string; torneios?: number[]; fetch?: typeof fetch };

/** Brasileirão Série A, Série B e Copa do Brasil (tournamentId da OddsPapi). */
export const TORNEIOS_PADRAO = [325, 390, 373];
const CASA_PADRAO = '1xbet';
const BASE = 'https://api.oddspapi.io/v4';

export type Categoria = 'RESULTADO' | 'GOLS' | 'HANDICAP' | 'ESCANTEIOS' | 'CARTÕES' | 'JOGADOR' | 'OUTROS';
export type MercadoSugerido = { grupo: string; descricao: string; multiplicador: number };
export type MercadoApi = MercadoSugerido & { casas: number; real?: boolean; categoria?: Categoria };

export type FixtureApi = {
  id: string;
  tournamentId: number;
  tournamentName: string;
  casa: string;
  fora: string;
  startTime: string;
  hasOdds: boolean;
};

type Market = {
  marketId: number;
  marketName?: string;
  marketType?: string;
  period?: string;
  handicap?: number;
  playerProp?: boolean;
  outcomes?: { outcomeId: number; outcomeName?: string }[];
};
type PlayerPrice = { active?: boolean; price?: number; playerName?: string | null };
export type OddsResp = {
  bookmakerOdds?: Record<
    string,
    {
      bookmakerIsActive?: boolean;
      suspended?: boolean;
      markets?: Record<
        string,
        { marketActive?: boolean; outcomes?: Record<string, { players?: Record<string, PlayerPrice> }> }
      >;
    }
  >;
};
export type ScoresResp = {
  scores?: { periods?: Record<string, { participant1Score?: number; participant2Score?: number }> };
};

// A OddsPapi limita a ~1 chamada por segundo por endpoint. Em vez de disparar e pagar retry
// (cada 429 também conta na cota), espaçamos as chamadas a >=1.1s dentro do isolate.
let proximaChamada = 0;
const req = async (cfg: OddsConfig, path: string, notFoundNull = false) => {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}apiKey=${encodeURIComponent(cfg.apiKey)}`;
  const espera = cfg.fetch ? 0 : Math.max(0, proximaChamada - Date.now());
  proximaChamada = Math.max(proximaChamada, Date.now()) + 1100;
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  let res = await (cfg.fetch ?? fetch)(url);
  // Residual: duas instâncias (isolates) ainda podem colidir — espera o retryMs e tenta de novo.
  for (let i = 0; i < 4 && res.status === 429; i++) {
    const ms = Number(((await res.json().catch(() => ({}))) as { error?: { retryMs?: number } }).error?.retryMs);
    await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(ms) ? ms + 150 : 1500, 5000)));
    res = await (cfg.fetch ?? fetch)(url);
  }
  if (notFoundNull && res.status === 404) return null;
  if (!res.ok) {
    console.error('[oddspapi] falha', path, res.status, (await res.text().catch(() => '')).slice(0, 200));
    throw new RuleError(
      res.status === 401 || res.status === 403
        ? 'Chave da OddsPapi inválida.'
        : res.status === 429
          ? 'Limite de requisições da OddsPapi atingido. Tente mais tarde.'
          : 'Falha ao buscar dados na OddsPapi. Tente de novo.',
    );
  }
  return res.json();
};

const semChave = () => new RuleError('Integração de odds não configurada (ODDS_PAPI_KEY).');

/** "id1000032566887160" ⇄ 1000032566887160 (fixture_id bigint do pool). */
export const fixtureNumerico = (externoId: string) => Number(externoId.replace(/^id/, ''));
export const externoDe = (fixtureId: string | number) => {
  const s = String(fixtureId);
  return /^\d+$/.test(s) ? `id${s}` : s;
};

/** Dia em Fortaleza (UTC-3): de 03:00Z do dia a 03:00Z do seguinte. */
const janelaDia = (data: string) => {
  const inicio = Date.parse(`${data}T03:00:00Z`);
  return { inicio, fim: inicio + 86400_000 };
};
const diaSeguinte = (data: string) => new Date(Date.parse(`${data}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10);
// A OddsPapi filtra por data UTC e `to` é exclusivo. O "dia" da rodada vai até 03:00Z do dia
// seguinte, então pedimos +2 pra cobrir jogos 00:00–03:00Z (ex.: 21:30 em Fortaleza).
const diaDepoisDeAmanha = (data: string) => new Date(Date.parse(`${data}T12:00:00Z`) + 2 * 86400_000).toISOString().slice(0, 10);

/** Jogos do dia nos campeonatos configurados — 1 request por campeonato. */
export async function fixturesDoDia(cfg: OddsConfig, data: string): Promise<FixtureApi[]> {
  const { inicio, fim } = janelaDia(data);
  const out: FixtureApi[] = [];
  for (const t of cfg.torneios?.length ? cfg.torneios : TORNEIOS_PADRAO) {
    // Sem jogos do campeonato no dia a OddsPapi responde 404 — é "vazio", não falha.
    const lista = ((await req(
      cfg,
      `/fixtures?tournamentId=${t}&from=${data}&to=${diaDepoisDeAmanha(data)}`,
      true,
    )) ?? []) as Record<string, unknown>[];
    for (const f of lista) {
      const ts = Date.parse(String(f.startTime));
      if (!(ts >= inicio && ts < fim)) continue;
      out.push({
        id: String(f.fixtureId),
        tournamentId: Number(f.tournamentId),
        tournamentName: String(f.tournamentName ?? ''),
        casa: String(f.participant1Name ?? ''),
        fora: String(f.participant2Name ?? ''),
        startTime: String(f.startTime),
        hasOdds: f.hasOdds === true,
      });
    }
  }
  return out;
}

/** Importa os jogos do dia pro pool (fixtures_dia). Odds ficam sob demanda (mercadosDaApi). */
export async function importarOdds(db: Db, cfg: OddsConfig | undefined, dataInput: unknown) {
  if (!cfg?.apiKey) throw semChave();
  const data = validarDataISO(dataInput);
  const jogos = await fixturesDoDia(cfg, data);
  if (jogos.length === 0)
    throw new RuleError('Nenhum jogo da Série A, Série B ou Copa do Brasil nessa data. Tenta outro dia.');
  const importados = [];
  for (const j of jogos) {
    const casa = nomeBR(j.casa);
    const fora = nomeBR(j.fora);
    const [row] = await db`
      insert into fixtures_dia (fixture_id, data, time_casa, time_fora, horario, campeonato, fonte, externo_id,
                                externo_esporte, mercados_sugeridos)
      values (${fixtureNumerico(j.id)}, ${data}, ${casa}, ${fora}, ${j.startTime},
              ${nomeTorneio(j)}, 'oddspapi', ${j.id}, ${String(j.tournamentId)}, '[]'::jsonb)
      on conflict (externo_id) do update set
        data = excluded.data, time_casa = excluded.time_casa, time_fora = excluded.time_fora,
        horario = excluded.horario, campeonato = excluded.campeonato,
        externo_esporte = excluded.externo_esporte,
        -- Nome do time mudou: as sugestões em cache citam o nome antigo e são refeitas.
        mercados_sugeridos = case
          when fixtures_dia.time_casa is distinct from excluded.time_casa
            or fixtures_dia.time_fora is distinct from excluded.time_fora then '[]'::jsonb
          else fixtures_dia.mercados_sugeridos end
      returning fixture_id`;
    importados.push({ fixture_id: Number(row.fixture_id), time_casa: casa, time_fora: fora });
  }
  return { importados, total: importados.length };
}

const NOMES_TORNEIO: Record<number, string> = { 325: 'Brasileirão Série A', 390: 'Brasileirão Série B', 373: 'Copa do Brasil' };
const nomeTorneio = (j: FixtureApi) => NOMES_TORNEIO[j.tournamentId] ?? j.tournamentName;

// Catálogo de mercados do futebol: muda raramente. Cache em memória (isolate) + banco
// (odds_catalogo, 7 dias) — sem o banco, cada isolate novo gastaria 1 request em /markets.
let catalogo: Map<number, Market> | null = null;
async function catalogoMercados(db: Db, cfg: OddsConfig): Promise<Map<number, Market>> {
  if (catalogo) return catalogo;
  const [salvo] = await db`select mercados from odds_catalogo
    where sport_id = 10 and atualizado_em > now() - interval '7 days'`;
  if (salvo) {
    catalogo = new Map((salvo.mercados as Market[]).map((m) => [m.marketId, m]));
    return catalogo;
  }
  const lista = ((await req(cfg, '/markets?sportId=10')) ?? []) as Market[];
  catalogo = new Map(lista.map((m) => [m.marketId, m]));
  await db`insert into odds_catalogo (sport_id, mercados) values (10, ${db.json(lista)})
           on conflict (sport_id) do update set mercados = excluded.mercados, atualizado_em = now()`;
  return catalogo;
}
/** Só para testes. */
export const _limparCatalogo = () => (catalogo = null);

const linhaMeia = (h: number) => Math.abs(Math.abs(h % 1) - 0.5) < 1e-9;
const sinal = (h: number) => (h > 0 ? `+${h}` : `${h}`);

const PROPS: Record<string, string> = {
  'players-anytimegoalscorer': 'MARCA NO JOGO',
  'players-firstgoalscorer': 'PRIMEIRO A MARCAR',
  'players-lastgoalscorer': 'ÚLTIMO A MARCAR',
  'players-firstcard': 'PRIMEIRO CARTÃO',
  'players-cards': 'LEVA CARTÃO',
  'players-assists': 'DÁ ASSISTÊNCIA',
  'playertotals-goals': 'GOLS DO JOGADOR',
  'playertotals-assists': 'ASSISTÊNCIAS DO JOGADOR',
  'playertotals-shots': 'CHUTES DO JOGADOR',
  'playertotals-shotsongoal': 'CHUTES NO GOL DO JOGADOR',
  'playertotals-cards': 'CARTÕES DO JOGADOR',
  'playertotals-tackles': 'DESARMES DO JOGADOR',
  'playertotals-saves': 'DEFESAS DO GOLEIRO',
  'playertotals-foulscommitted': 'FALTAS DO JOGADOR',
  'playertotals-offsides': 'IMPEDIMENTOS DO JOGADOR',
};

/** Nome do jogador no feed vem "Sobrenome, Nome" — vira "NOME SOBRENOME". */
const nomeJogador = (s: string) => {
  const [sob, nome] = s.split(',').map((x) => x.trim());
  return (nome ? `${nome} ${sob}` : sob).toUpperCase();
};

type Opcao = { grupo: string; descricao: string; categoria: Categoria; real?: boolean } | null;

/**
 * Traduz (mercado, opção) da OddsPapi pro cardápio do PALPIT. Os nomes de grupo/descrição seguem o
 * formato que compat.ts sabe liquidar pelo placar ("GOLS 2.5"/"MAIS DE 2.5", "HANDICAP"/"CASA -1",
 * "GOLS 1º TEMPO"...). Mercados que o placar não resolve usam descrições fora desse formato e ficam
 * pra liquidação manual. 2º tempo e prorrogação ficam de fora (o placar não separa esses períodos).
 */
function traduzir(m: Market, saida: string, jogador: string | null, C: string, F: string): Opcao {
  const tipo = m.marketType ?? '';
  const h = Number(m.handicap ?? 0);
  const periodo = m.period ?? '';
  const lado = (s: string) => (s === '1' ? C : s === '2' ? F : s === 'X' ? 'EMPATE' : null);
  const maisMenos = (s: string) => (s === 'Over' ? `MAIS DE ${h}` : s === 'Under' ? `MENOS DE ${h}` : null);
  const simNao = (s: string) => (s === 'Yes' ? 'SIM' : s === 'No' ? 'NÃO' : null);

  if (m.playerProp) {
    const nome = PROPS[tipo];
    if (!nome || !jogador || !['result', 'fulltime'].includes(periodo)) return null;
    const j = nomeJogador(jogador);
    if (tipo.startsWith('players-')) {
      // "Sim" é o mercado que interessa; o "Não" do jogador tem odd baixa e confunde.
      if (saida !== 'Yes') return null;
      return { grupo: nome, descricao: j, categoria: 'JOGADOR' };
    }
    const mm = saida === 'Over' ? `MAIS DE ${h}` : saida === 'Under' ? `MENOS DE ${h}` : null;
    if (!mm) return null;
    return { grupo: `${nome} ${h}`, descricao: `${j} — ${mm}`, categoria: 'JOGADOR' };
  }

  if (periodo !== 'fulltime' && periodo !== 'p1') return null;
  const t1 = periodo === 'p1';
  const sfx = t1 ? ' 1º TEMPO' : '';
  switch (tipo) {
    case '1x2': {
      const d = lado(saida);
      return d ? { grupo: t1 ? 'RESULTADO 1º TEMPO' : 'RESULTADO', descricao: d, categoria: 'RESULTADO', real: true } : null;
    }
    case 'bothteamsscore': {
      const d = simNao(saida);
      return d ? { grupo: `AMBOS MARCAM${sfx}`, descricao: d, categoria: 'GOLS', real: true } : null;
    }
    case 'doublechance': {
      if (t1) return null;
      const d = saida === '1X' ? `${C} OU EMPATE` : saida === '2X' || saida === 'X2' ? `${F} OU EMPATE` : saida === '12' ? `${C} OU ${F}` : null;
      return d ? { grupo: 'DUPLA CHANCE', descricao: d, categoria: 'RESULTADO', real: true } : null;
    }
    case 'drawnobet': {
      if (t1) return null;
      const d = saida === '1' ? C : saida === '2' ? F : null;
      return d ? { grupo: 'EMPATE ANULA', descricao: d, categoria: 'RESULTADO', real: true } : null;
    }
    case 'totals': {
      const d = linhaMeia(h) ? maisMenos(saida) : null;
      return d ? { grupo: t1 ? 'GOLS 1º TEMPO' + ` ${h}` : `GOLS ${h}`, descricao: d, categoria: 'GOLS', real: true } : null;
    }
    case 'spreads': {
      if (h === 0 || !(linhaMeia(h) || Number.isInteger(h))) return null;
      const d = saida === '1' ? `CASA ${sinal(h)}` : saida === '2' ? `FORA ${sinal(-h)}` : null;
      return d ? { grupo: `HANDICAP${sfx}`, descricao: d, categoria: 'HANDICAP', real: true } : null;
    }
    case 'totals-corners': {
      const d = linhaMeia(h) ? maisMenos(saida) : null;
      return d ? { grupo: `ESCANTEIOS${sfx} ${h}`, descricao: d, categoria: 'ESCANTEIOS' } : null;
    }
    case 'spreads-corners': {
      if (t1 || h === 0 || !(linhaMeia(h) || Number.isInteger(h))) return null;
      const d = saida === '1' ? `CASA ${sinal(h)}` : saida === '2' ? `FORA ${sinal(-h)}` : null;
      return d ? { grupo: 'ESCANTEIOS HCP', descricao: d, categoria: 'ESCANTEIOS' } : null;
    }
    case 'teamtotals-corners-team1':
    case 'teamtotals-corners-team2': {
      const time = tipo.endsWith('team1') ? C : F;
      const d = linhaMeia(h) ? maisMenos(saida) : null;
      return d ? { grupo: `ESCANTEIOS ${time}${sfx} ${h}`, descricao: `${time} ${d}`, categoria: 'ESCANTEIOS' } : null;
    }
    case 'totals-bookings': {
      if (t1) return null;
      const d = linhaMeia(h) ? maisMenos(saida) : null;
      return d ? { grupo: `CARTÕES ${h}`, descricao: d, categoria: 'CARTÕES' } : null;
    }
    case 'teamtotals-bookings-team1':
    case 'teamtotals-bookings-team2': {
      if (t1) return null;
      const time = tipo.endsWith('team1') ? C : F;
      const d = linhaMeia(h) ? maisMenos(saida) : null;
      return d ? { grupo: `CARTÕES ${time} ${h}`, descricao: `${time} ${d}`, categoria: 'CARTÕES' } : null;
    }
    case 'teamtotals-team1':
    case 'teamtotals-team2': {
      const time = tipo.endsWith('team1') ? C : F;
      const d = linhaMeia(h) ? maisMenos(saida) : null;
      // Descrição com o nome do time na frente: não é "MAIS DE x" do jogo, então fica manual.
      return d ? { grupo: `GOLS ${time}${sfx} ${h}`, descricao: `${time} ${d}`, categoria: 'GOLS' } : null;
    }
    case 'correctscore': {
      if (!/^\d+:\d+$/.test(saida)) return null;
      return { grupo: `PLACAR EXATO${sfx}`, descricao: saida.replace(':', ' x '), categoria: 'OUTROS' };
    }
    case 'oddeven': {
      if (t1) return null;
      const d = saida === 'Odd' ? 'ÍMPAR' : saida === 'Even' ? 'PAR' : null;
      return d ? { grupo: 'GOLS PAR OU ÍMPAR', descricao: `TOTAL ${d}`, categoria: 'GOLS' } : null;
    }
    case 'halftime-fulltime': {
      const [a, b] = saida.split('/').map(lado);
      return a && b ? { grupo: 'INTERVALO / FINAL', descricao: `${a} / ${b}`, categoria: 'RESULTADO' } : null;
    }
    case 'wintonil-team1':
    case 'wintonil-team2': {
      if (t1 || saida !== 'Yes') return null;
      const time = tipo.endsWith('team1') ? C : F;
      return { grupo: 'VENCE SEM SOFRER GOL', descricao: `${time} VENCE SEM SOFRER`, categoria: 'RESULTADO' };
    }
    default:
      return null;
  }
}

/** Odds da casa configurada (1xBet) de um jogo -> cardápio do PALPIT, já seccionado por categoria. */
export function mercadosDasOdds(
  resp: OddsResp,
  cat: Map<number, Market>,
  casa: string,
  fora: string,
  bookmaker = CASA_PADRAO,
): MercadoApi[] {
  const book = resp.bookmakerOdds?.[bookmaker];
  if (!book?.markets || book.bookmakerIsActive === false) return [];
  const C = casa.toUpperCase();
  const F = fora.toUpperCase();
  const vistos = new Set<string>();
  const out: MercadoApi[] = [];
  for (const [mid, mk] of Object.entries(book.markets)) {
    const meta = cat.get(Number(mid));
    if (!meta || mk.marketActive === false) continue;
    for (const [oid, oc] of Object.entries(mk.outcomes ?? {})) {
      const saida = meta.outcomes?.find((o) => o.outcomeId === Number(oid))?.outcomeName ?? '';
      for (const p of Object.values(oc.players ?? {})) {
        if (p.active === false || !p.price) continue;
        const v = Math.round(p.price * 100) / 100;
        if (!(v >= 1.01 && v <= (meta.playerProp ? 50 : 30))) continue;
        const t = traduzir(meta, saida, p.playerName ?? null, C, F);
        if (!t) continue;
        const k = `${t.grupo}|${t.descricao}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        out.push({ grupo: t.grupo, descricao: t.descricao, multiplicador: v, casas: 1, real: t.real, categoria: t.categoria });
      }
    }
  }
  return ordenar(limpar(out));
}

const ORDEM_CAT: Categoria[] = ['RESULTADO', 'GOLS', 'HANDICAP', 'ESCANTEIOS', 'CARTÕES', 'JOGADOR', 'OUTROS'];
const ORDEM_GRUPO = ['RESULTADO', 'AMBOS MARCAM', 'DUPLA CHANCE', 'EMPATE ANULA', 'GOLS 2.5'];
const linhaDoGrupo = (g: string) => Number(g.match(/(\d+(?:\.\d+)?)$/)?.[1] ?? 0);

/** Tira linhas extremas: grupo com 1 lado só ou em que todo lado tem >85% de chance. */
function limpar(ms: MercadoApi[]): MercadoApi[] {
  const porGrupo = new Map<string, MercadoApi[]>();
  for (const m of ms) porGrupo.set(m.grupo, [...(porGrupo.get(m.grupo) ?? []), m]);
  return ms.filter((m) => {
    const g = porGrupo.get(m.grupo)!;
    if (m.categoria === 'JOGADOR' || m.grupo.startsWith('PLACAR EXATO') || m.grupo === 'VENCE SEM SOFRER GOL') return true;
    if (g.length < 2) return false;
    return !g.every((x) => 1 / x.multiplicador > 0.85);
  });
}

function ordenar(ms: MercadoApi[]): MercadoApi[] {
  const rank = (m: MercadoApi) => {
    const i = ORDEM_GRUPO.indexOf(m.grupo);
    return i >= 0 ? i : ORDEM_GRUPO.length;
  };
  return [...ms].sort(
    (a, b) =>
      ORDEM_CAT.indexOf(a.categoria ?? 'OUTROS') - ORDEM_CAT.indexOf(b.categoria ?? 'OUTROS') ||
      rank(a) - rank(b) ||
      a.grupo.replace(/\s[\d.]+$/, '').localeCompare(b.grupo.replace(/\s[\d.]+$/, '')) ||
      linhaDoGrupo(a.grupo) - linhaDoGrupo(b.grupo) ||
      (a.categoria === 'JOGADOR' || a.grupo.startsWith('PLACAR') ? a.multiplicador - b.multiplicador : 0),
  );
}

async function buscarMercados(db: Db, cfg: OddsConfig, externoId: string, casa: string, fora: string) {
  const bookmaker = cfg.bookmaker ?? CASA_PADRAO;
  const [resp, cat] = await Promise.all([
    req(cfg, `/odds?fixtureId=${encodeURIComponent(externoId)}&bookmakers=${bookmaker}`, true) as Promise<OddsResp | null>,
    catalogoMercados(db, cfg),
  ]);
  return resp ? mercadosDasOdds(resp, cat, casa, fora, bookmaker) : [];
}

/**
 * Odds de um jogo da rodada. Serve o cache de mercados_sugeridos quando tem menos de 6h —
 * o pool já pré-busca odds ao listar os fixtures, então reutilizar aqui corta o consumo pela metade.
 * `forcar` refaz a chamada (botão "Renovar odds").
 */
export async function mercadosDaApi(db: Db, cfg: OddsConfig | undefined, jogoId: string, forcar = false) {
  if (!cfg?.apiKey) throw semChave();
  const [j] = await db`
    select f.externo_id, f.fonte, f.mercados_sugeridos, f.odds_atualizadas_em,
           j.time_casa, j.time_fora from jogos j
    left join fixtures_dia f on f.fixture_id = j.fixture_id
    where j.id = ${jogoId}`;
  if (!j) throw new RuleError('Jogo não encontrado.');
  if (!j.externo_id || j.fonte !== 'oddspapi') throw new RuleError('Esse jogo foi cadastrado na mão; não há odds da API para ele.');
  const cache = (j.mercados_sugeridos as MercadoApi[] | null) ?? [];
  const fresco = j.odds_atualizadas_em != null && Date.parse(String(j.odds_atualizadas_em)) > Date.now() - 6 * 3600_000;
  // Cache fresco conta mesmo vazio: "a API não tem odds pra esse jogo" também é resposta —
  // sem isso jogos sem odds refazem a request em cada acesso.
  if (!forcar && fresco) return { mercados: cache, cacheado: true };
  const mercados = await buscarMercados(db, cfg, j.externo_id as string, j.time_casa as string, j.time_fora as string);
  // Feed vazio (jogo suspenso/casa sem odds): mantém o cache que já existia e marca o timestamp
  // pra não refazer a request na próxima chamada.
  await db`update fixtures_dia set mercados_sugeridos = ${db.json(mercados.length ? mercados : cache)},
           odds_atualizadas_em = now() where externo_id = ${j.externo_id}`;
  return { mercados: mercados.length ? mercados : cache, cacheado: !mercados.length && cache.length > 0 };
}

/**
 * Versão por fixture do pool (criador de desafio e sugestões do pool): só os mercados principais,
 * que o placar liquida sozinho — o dono do desafio não informa escanteios/cartões nem jogador.
 */
export async function mercadosDaFixture(db: Db, cfg: OddsConfig | undefined, fixtureId: string) {
  if (!cfg?.apiKey) return [];
  const externoId = externoDe(fixtureId);
  const [f] = await db`
    select time_casa, time_fora, mercados_sugeridos, fonte,
           coalesce(odds_atualizadas_em < now() - interval '6 hours', true) as velho
    from fixtures_dia where externo_id = ${externoId}`;
  if (!f || f.fonte !== 'oddspapi') return [];
  const cache = (f.mercados_sugeridos as MercadoApi[] | null) ?? [];
  // Cache com menos de 6h — inclusive vazio ("a API não tem odds pra esse jogo" também é resposta).
  // Sem isso, jogos sem odds refaziam a request em cada acesso e estouravam a cota.
  if (!f.velho) return principais(cache);
  const mercados = await buscarMercados(db, cfg, externoId, f.time_casa as string, f.time_fora as string);
  // Feed sem mercados agora: mantém as sugestões que já tinham vindo, mas marca o timestamp
  // pra não refazer a request na próxima chamada.
  const guardar = mercados.length ? mercados : cache;
  await db`update fixtures_dia set mercados_sugeridos = ${db.json(guardar)}, odds_atualizadas_em = now()
           where externo_id = ${externoId}`;
  return principais(guardar);
}

export type Placar = {
  status: 'live' | 'finished' | 'unknown';
  casa: number;
  fora: number;
  casa1t?: number;
  fora1t?: number;
};

/** Placar de um jogo (só gols). "fulltime" presente = jogo encerrado. Sem placar ainda: null. */
export async function placarDoJogo(cfg: OddsConfig, externoId: string): Promise<Placar | null> {
  const r = (await req(cfg, `/scores?fixtureId=${encodeURIComponent(externoId)}`, true)) as ScoresResp | null;
  const p = r?.scores?.periods;
  if (!p) return null;
  const fim = p.fulltime;
  const atual = fim ?? p.result;
  if (atual?.participant1Score == null || atual.participant2Score == null) return null;
  const t1 = p.p1;
  return {
    status: fim ? 'finished' : 'live',
    casa: Number(atual.participant1Score),
    fora: Number(atual.participant2Score),
    casa1t: fim && t1?.participant1Score != null ? Number(t1.participant1Score) : undefined,
    fora1t: fim && t1?.participant2Score != null ? Number(t1.participant2Score) : undefined,
  };
}

/** Cardápio enxuto pra montar a rodada rápido: resultado, ambos marcam, dupla chance, empate anula e gols 1.5/2.5/3.5. */
export const GRUPOS_PRINCIPAIS = ['RESULTADO', 'AMBOS MARCAM', 'DUPLA CHANCE', 'EMPATE ANULA', 'GOLS 1.5', 'GOLS 2.5', 'GOLS 3.5'];
export const principais = <T extends { grupo: string }>(ms: T[]) => ms.filter((m) => GRUPOS_PRINCIPAIS.includes(m.grupo));
