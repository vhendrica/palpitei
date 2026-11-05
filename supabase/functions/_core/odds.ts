import type { Db } from './db.ts';
import { RuleError } from './errors.ts';
import { validarDataISO } from './validation.ts';

/**
 * Integração com a 5DollarFootballAPI (api.5dollarfootballapi.com/v1).
 * Plano FREE: 60 req/hora — então:
 * - fixtures do dia = 1 request total (janela de 24h, ligas filtradas no servidor);
 * - placares = 1 request por data pendente (só quando tem jogo rolando — ver resultados.ts);
 * - odds = 1 request por jogo, sob demanda (cache em fixtures_dia.mercados_sugeridos).
 */
export type OddsConfig = { apiKey: string; ligas?: string[]; fetch?: typeof fetch };

/** Ligas do MVP no plano FREE — migrando pro Pro basta trocar esta lista (ou FOOTBALL_LIGAS). */
export const LIGAS_MVP = [
  'England Premier League',
  'Spain La Liga',
  'Italy Serie A',
  'Germany Bundesliga I',
  'France Ligue 1',
];
export const ESPORTES_PADRAO = LIGAS_MVP;

const BASE = 'https://api.5dollarfootballapi.com/v1';
const TZ = 'America/Fortaleza';

export type MercadoSugerido = { grupo: string; descricao: string; multiplicador: number };
export type MercadoApi = MercadoSugerido & { casas: number };

export type FixtureApi = {
  id: number;
  league: { id: number; name: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  kickoff_utc: string;
  kickoff_ts: number;
  status: 'scheduled' | 'live' | 'finished' | 'unknown';
  goals?: { home: number; away: number; half_home?: number; half_away?: number };
  corners?: { home: number; away: number; half_home?: number; half_away?: number };
  cards?: { home: { yellow: number; red: number }; away: { yellow: number; red: number } };
};

type OddsLinha = { line?: number; home?: number; draw?: number; away?: number; over?: number; under?: number; yes?: number; no?: number };
type OddsBloco = { opening?: OddsLinha | null; closing?: OddsLinha | null; inplay?: OddsLinha | null };
type OddsResp = { fixture_id: number; bookmakers: { slug: string; odds: Record<string, OddsBloco | OddsBloco[] | undefined> }[] };

const req = async (cfg: OddsConfig, path: string) => {
  const res = await (cfg.fetch ?? fetch)(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  });
  if (!res.ok) {
    console.error('[odds] falha', path, res.status, (await res.text().catch(() => '')).slice(0, 200));
    throw new RuleError(
      res.status === 401
        ? 'Chave da Football API inválida.'
        : res.status === 429
          ? 'Limite de requisições da API de futebol atingido. Tente mais tarde.'
          : 'Falha ao buscar dados. Tente de novo.',
    );
  }
  return (await res.json()).data;
};

/** Meia-noite em Fortaleza = 03:00 UTC. */
const janelaDia = (data: string) => {
  const inicio = Date.parse(`${data}T03:00:00Z`) / 1000;
  return { inicio, fim: inicio + 86400 };
};

/** Todos os jogos do dia nas ligas do MVP — 1 request só. */
export async function fixturesDoDia(cfg: OddsConfig, data: string): Promise<FixtureApi[]> {
  const { inicio, fim } = janelaDia(data);
  const d = await req(cfg, `/fixtures?start_time=${inicio}&end_time=${fim}&per_page=100`);
  const ligas = (cfg.ligas?.length ? cfg.ligas : LIGAS_MVP).map((s) => s.toUpperCase());
  return ((d ?? []) as FixtureApi[]).filter((j) => ligas.includes(j.league?.name?.toUpperCase() ?? ''));
}

/** Importa os jogos do dia pro pool (fixtures_dia). Odds ficam sob demanda (mercadosDaApi). */
export async function importarOdds(db: Db, cfg: OddsConfig | undefined, dataInput: unknown) {
  if (!cfg?.apiKey) throw new RuleError('Integração de futebol não configurada (FOOTBALL_API_KEY).');
  const data = validarDataISO(dataInput);
  const jogos = await fixturesDoDia(cfg, data);
  const importados = [];
  for (const j of jogos) {
    const [row] = await db`
      insert into fixtures_dia (fixture_id, data, time_casa, time_fora, horario, campeonato, fonte, externo_id,
                                externo_esporte, mercados_sugeridos)
      values (${j.id}, ${data}, ${j.teams.home.name}, ${j.teams.away.name}, ${j.kickoff_utc},
              ${j.league.name}, 'api_football', ${String(j.id)}, ${j.league.name}, '[]'::jsonb)
      on conflict (externo_id) do update set
        data = excluded.data, time_casa = excluded.time_casa, time_fora = excluded.time_fora,
        horario = excluded.horario, campeonato = excluded.campeonato,
        externo_esporte = excluded.externo_esporte
      returning fixture_id`;
    importados.push({ fixture_id: Number(row.fixture_id), time_casa: j.teams.home.name, time_fora: j.teams.away.name });
  }
  return { importados, total: importados.length };
}

const fechamento = (b: OddsBloco | OddsBloco[] | undefined) =>
  !b || Array.isArray(b) ? null : (b.closing ?? b.opening ?? null);
const linhaMeio = (x: unknown): x is number => typeof x === 'number' && Math.abs((x % 1) - 0.5) < 1e-9;

// ---- Escada derivada: a API só dá 1 linha de escanteios/cartões; estimamos as vizinhas
// ajustando um Poisson à probabilidade real (sem vig) da linha de mercado.
const poissonTail = (n: number, mu: number) => {
  let t = Math.exp(-mu);
  let s = t;
  for (let k = 1; k < n; k++) {
    t = (t * mu) / k;
    s += t;
  }
  return 1 - s;
};
const ajustaMu = (n: number, pAlvo: number) => {
  let lo = 0.2;
  let hi = 40;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (poissonTail(n, mid) < pAlvo) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

/** Bet365: abertura/fechamento das 12 famílias de mercado -> nosso cardápio seccionado. */
export function mercadosDasOdds(resp: OddsResp, casa: string, fora: string): MercadoApi[] {
  const bet = resp.bookmakers?.find((b) => b.slug === 'bet365') ?? resp.bookmakers?.[0];
  if (!bet?.odds) return [];
  const m = bet.odds;
  const out: MercadoApi[] = [];
  const push = (grupo: string, descricao: string, mult: unknown) => {
    const v = Number(mult);
    if (Number.isFinite(v) && v > 1) out.push({ grupo, descricao, multiplicador: Math.round(v * 100) / 100, casas: 1 });
  };
  const CASA = casa.toUpperCase();
  const FORA = fora.toUpperCase();

  // PRINCIPAL: 1X2 + derivados (dupla chance, empate anula)
  const x2 = fechamento(m['1x2']);
  if (x2?.home && x2.draw && x2.away) {
    const dc = (a: number, b: number) => 1 / (1 / a + 1 / b);
    push('RESULTADO', CASA, x2.home);
    push('RESULTADO', 'EMPATE', x2.draw);
    push('RESULTADO', FORA, x2.away);
    push('DUPLA CHANCE', `${CASA} OU EMPATE`, dc(x2.home, x2.draw));
    push('DUPLA CHANCE', `${FORA} OU EMPATE`, dc(x2.away, x2.draw));
    push('DUPLA CHANCE', `${CASA} OU ${FORA}`, dc(x2.home, x2.away));
    push('EMPATE ANULA', CASA, 1 + x2.home / x2.away);
    push('EMPATE ANULA', FORA, 1 + x2.away / x2.home);
  }

  // GOLS: escada fixa de linhas (.5) + ambas marcam
  const fixed = Array.isArray(m['goal_line_fixed']) ? m['goal_line_fixed'] : [];
  for (const l of fixed) {
    const f = fechamento(l);
    if (!f || !linhaMeio(l.line) || (l.line! > 5.5)) continue;
    const g = `GOLS ${l.line}`;
    push(g, `MAIS DE ${l.line}`, f.over);
    push(g, `MENOS DE ${l.line}`, f.under);
  }
  const btts = fechamento(m['btts']);
  if (btts) {
    push('AMBOS MARCAM', 'SIM', btts.yes);
    push('AMBOS MARCAM', 'NÃO', btts.no);
  }

  // HANDICAP: linha principal (.5 ou inteira); linha 0 já é coberta pelo EMPATE ANULA
  // Linhas quarto (.25/.75 = split de aposta) não cabem no modelo PALPIT: só .5 ou inteira.
  const hc = fechamento(m['asian_handicap']);
  if (hc?.line != null && hc.line !== 0 && (linhaMeio(hc.line) || Number.isInteger(hc.line))) {
    const f = (l: number) => (l > 0 ? `+${l}` : `${l}`);
    push('HANDICAP', `CASA ${f(hc.line)}`, hc.home);
    push('HANDICAP', `FORA ${f(-hc.line)}`, hc.away);
  }

  // ESCANTEIOS / CARTÕES: escada de linhas derivada da linha real (mesma faixa do filtro 30-70%)
  // Um grupo por linha, como "GOLS 2.5" — a linha real da casa mantém o preço real.
  const escada = (prefixo: string, real: OddsLinha, maxLinha: number) => {
    if (real.line == null || !real.over || !real.under) return;
    const po = 1 / real.over;
    const pu = 1 / real.under;
    const margem = po + pu;
    const mu = ajustaMu(Math.floor(real.line) + 1, po / margem);
    for (let l = 0.5; l <= maxLinha; l += 1) {
      const g = `${prefixo} ${l}`;
      const pO = poissonTail(Math.floor(l) + 1, mu);
      const pU = 1 - pO;
      if (l === real.line) {
        push(g, `MAIS DE ${l}`, real.over);
        push(g, `MENOS DE ${l}`, real.under);
      } else {
        push(g, `MAIS DE ${l}`, 1 / Math.max(0.001, pO * margem));
        push(g, `MENOS DE ${l}`, 1 / Math.max(0.001, pU * margem));
      }
    }
  };
  const corner = fechamento(m['corner_line']);
  if (corner) escada('ESCANTEIOS', corner, 19.5);
  const cornerHc = fechamento(m['corner_asian']);
  if (cornerHc?.line != null && cornerHc.line !== 0 && (linhaMeio(cornerHc.line) || Number.isInteger(cornerHc.line))) {
    const f = (l: number) => (l > 0 ? `+${l}` : `${l}`);
    push('ESCANTEIOS HCP', `CASA ${f(cornerHc.line)}`, cornerHc.home);
    push('ESCANTEIOS HCP', `FORA ${f(-cornerHc.line)}`, cornerHc.away);
  }
  const cards = fechamento(m['card_line']);
  if (cards) escada('CARTÕES', cards, 11.5);

  // 1º TEMPO: gols, handicap e escanteios do primeiro tempo
  const g1 = fechamento(m['goal_line_half']);
  if (g1?.line != null && linhaMeio(g1.line)) {
    push('GOLS 1º TEMPO', `MAIS DE ${g1.line}`, g1.over);
    push('GOLS 1º TEMPO', `MENOS DE ${g1.line}`, g1.under);
  }
  const h1 = fechamento(m['asian_handicap_half']);
  if (h1?.line != null && h1.line !== 0 && (linhaMeio(h1.line) || Number.isInteger(h1.line))) {
    const f = (l: number) => (l > 0 ? `+${l}` : `${l}`);
    push('HANDICAP 1º TEMPO', `CASA ${f(h1.line)}`, h1.home);
    push('HANDICAP 1º TEMPO', `FORA ${f(-h1.line)}`, h1.away);
  }
  const c1 = fechamento(m['corner_line_half']);
  if (c1) escada('ESCANTEIOS 1º TEMPO', c1, 9.5);
  return filtrarJogaveis(out);
}

/**
 * Só sugestões "jogáveis": probabilidade implícita (1/odd) entre ~30% e ~70%.
 * Grupos com >4 opções ficam com as 4 mais equilibradas; com <=4 ficam todas.
 */
function filtrarJogaveis(ms: MercadoApi[]): MercadoApi[] {
  const porGrupo = new Map<string, MercadoApi[]>();
  for (const m of ms) porGrupo.set(m.grupo, [...(porGrupo.get(m.grupo) ?? []), m]);
  const out: MercadoApi[] = [];
  for (const g of porGrupo.values()) {
    // grupo cuja opção menos provável ainda tem >85% (linha extremada, ex.: "MENOS DE 15.5") cai fora
    if (g.every((m) => 1 / m.multiplicador > 0.85)) continue;
    if (g.length <= 4) {
      out.push(...g);
      continue;
    }
    const centro = (m: MercadoApi) => Math.abs(1 / m.multiplicador - 0.5);
    const naFaixa = g.filter((m) => {
      const p = 1 / m.multiplicador;
      return p >= 0.3 && p <= 0.7;
    });
    const ordenados = [...g].sort((a, b) => centro(a) - centro(b));
    const sel =
      naFaixa.length >= 4 ? naFaixa.slice(0, 4) : [...naFaixa, ...ordenados.filter((m) => !naFaixa.includes(m))].slice(0, 4);
    out.push(...sel);
  }
  return out;
}

/** Odds Bet365 de um jogo do pool/múltipla — 1 request por jogo, cacheado em mercados_sugeridos. */
export async function mercadosDaApi(db: Db, cfg: OddsConfig | undefined, jogoId: string) {
  if (!cfg?.apiKey) throw new RuleError('Integração de futebol não configurada (FOOTBALL_API_KEY).');
  const [j] = await db`
    select f.externo_id, j.time_casa, j.time_fora from jogos j
    left join fixtures_dia f on f.fixture_id = j.fixture_id
    where j.id = ${jogoId}`;
  if (!j) throw new RuleError('Jogo não encontrado.');
  if (!j.externo_id) throw new RuleError('Esse jogo foi cadastrado na mão; não há odds da API para ele.');
  const resp = (await req(cfg, `/fixtures/${j.externo_id}/odds`)) as OddsResp;
  const mercados = mercadosDasOdds(resp, j.time_casa as string, j.time_fora as string);
  await db`update fixtures_dia set mercados_sugeridos = ${db.json(mercados)}, odds_atualizadas_em = now()
           where externo_id = ${j.externo_id}`;
  return { mercados };
}

/** Versão por fixture do pool (para o criador de desafio ver os sugeridos). */
export async function mercadosDaFixture(db: Db, cfg: OddsConfig | undefined, externoId: string) {
  if (!cfg?.apiKey) return [];
  const [f] = await db`select time_casa, time_fora, mercados_sugeridos from fixtures_dia where externo_id = ${externoId}`;
  if (!f) return [];
  const cache = f.mercados_sugeridos as MercadoApi[] | null;
  if (cache?.length) return cache;
  const resp = (await req(cfg, `/fixtures/${externoId}/odds`)) as OddsResp;
  const mercados = mercadosDasOdds(resp, f.time_casa as string, f.time_fora as string);
  await db`update fixtures_dia set mercados_sugeridos = ${db.json(mercados)}, odds_atualizadas_em = now()
           where externo_id = ${externoId}`;
  return mercados;
}