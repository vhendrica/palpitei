import type { Db } from './db.ts';
import { RuleError } from './errors.ts';
import type { MercadoSugerido } from './odds.ts';

/**
 * Integração com a OddsPapi (v5.oddspapi.io/{lang}) — fonte dos player props
 * ("Neymar marca gol"). Cada jogo custa ~4 requests (fixtures, odds, markets, players);
 * sport/markets ficam cacheados no isolate e os props sugeridos não vão pro cache do
 * admin — o admin pede sob demanda e escolhe o que vira mercado JOGADORES.
 * A liquidação desses mercados é manual (POST /admin/mercados/:id/resultado), sem
 * gastar request da /fixtures/settlement.
 */
export type OddsPapiConfig = { apiKey: string; bookmaker?: string; fetch?: typeof fetch };

const BASE = 'https://v5.oddspapi.io/pt';

const req = async (cfg: OddsPapiConfig, path: string) => {
  const sep = path.includes('?') ? '&' : '?';
  const res = await (cfg.fetch ?? fetch)(`${BASE}${path}${sep}apiKey=${cfg.apiKey}`);
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

type Sport = { sportId: number; slug?: string; sportSlug?: string; sportName?: string };
type Fixture = {
  fixtureId: string;
  startTime: number;
  participants?: {
    participant1Name?: string | null;
    participant1ShortName?: string | null;
    participant2Name?: string | null;
    participant2ShortName?: string | null;
  } | null;
  status?: { statusId?: number } | null;
};
type Market = {
  marketId: number;
  sportId?: number | null;
  marketType?: string | null;
  playerProp?: boolean | null;
  marketName?: string | null;
  marketNameShort?: string | null;
  outcomes?: { outcomeId: number; outcomeName?: string | null }[] | null;
};
type PricePoint = {
  bookmaker: string;
  outcomeId: number;
  playerId: number;
  price: number;
  active: boolean;
  marketId?: number | null;
  changedAt?: number;
};
type FixtureOdds = { odds?: Record<string, PricePoint[] | Record<string, PricePoint[]>> };

// Cache por isolate: sportId e cardápio de mercados mudam raramente.
let sportIdFut: number | null = null;
const marketsCache = new Map<number, Market[]>();
const playersCache = new Map<number, string>();

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const mesmoTime = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
};

async function sportIdFutebol(cfg: OddsPapiConfig): Promise<number> {
  if (sportIdFut) return sportIdFut;
  const sports = (await req(cfg, '/sports')) as Sport[];
  const fut =
    sports.find((s) => (s.slug ?? s.sportSlug ?? '') === 'football') ??
    sports.find((s) => /foot|soccer|futebol/i.test(s.sportName ?? ''));
  if (!fut) throw new RuleError('OddsPapi: esporte futebol não encontrado.');
  sportIdFut = fut.sportId;
  return sportIdFut;
}

async function mercadosProps(cfg: OddsPapiConfig, sportId: number): Promise<Market[]> {
  const hit = marketsCache.get(sportId);
  if (hit) return hit;
  const markets = ((await req(cfg, `/markets?sportId=${sportId}`)) as Market[]).filter(
    (m) => m.playerProp === true,
  );
  marketsCache.set(sportId, markets);
  return markets;
}

/** Player props de um jogo do pool/rodada — casa o fixture pela dupla casa/fora na janela de ±12h. */
export async function propsDoJogo(db: Db, cfg: OddsPapiConfig | undefined, jogoId: string) {
  if (!cfg?.apiKey) throw new RuleError('OddsPapi não configurada (ODDS_PAPI_KEY).');
  const [j] = await db`
    select time_casa, time_fora, horario::text as horario, campeonato from jogos where id = ${jogoId}`;
  if (!j) throw new RuleError('Jogo não encontrado.');

  const sportId = await sportIdFutebol(cfg);
  const t = Date.parse(j.horario as string) / 1000;
  const fixtures = (await req(
    cfg,
    `/fixtures?sportId=${sportId}&startTimeFrom=${t - 43200}&startTimeTo=${t + 43200}`,
  )) as Fixture[];
  const fx = fixtures.find((f) => {
    const p = f.participants;
    if (!p) return false;
    const casaOk = [p.participant1Name, p.participant1ShortName].some(
      (n) => n && mesmoTime(n, j.time_casa as string),
    );
    const foraOk = [p.participant2Name, p.participant2ShortName].some(
      (n) => n && mesmoTime(n, j.time_fora as string),
    );
    return casaOk && foraOk;
  });
  if (!fx)
    throw new RuleError(
      `${j.time_casa} x ${j.time_fora} não encontrado na OddsPapi nessa data. Jogo cadastrado na mão?`,
    );

  const [resp, markets] = await Promise.all([
    req(cfg, `/fixtures/odds?fixtureIds=${fx.fixtureId}&bookmakers=${cfg.bookmaker ?? 'bet365'}`) as Promise<FixtureOdds[]>,
    mercadosProps(cfg, sportId),
  ]);
  const porMarket = new Map(markets.map((m) => [m.marketId, m]));
  const outcomeDe = (m: Market | undefined, outcomeId: number) =>
    m?.outcomes?.find((o) => o.outcomeId === outcomeId)?.outcomeName ?? '';

  // Preço mais recente por (marketId, outcomeId, playerId).
  const melhor = new Map<string, PricePoint>();
  const fixture = (resp as FixtureOdds[])[0];
  for (const lista of Object.values(fixture?.odds ?? {})) {
    const pontos = Array.isArray(lista) ? lista : Object.values(lista ?? {}).flat();
    for (const p of pontos as PricePoint[]) {
      if (!p.active || !p.playerId) continue;
      const key = `${p.marketId}:${p.outcomeId}:${p.playerId}`;
      const atual = melhor.get(key);
      if (!atual || (p.changedAt ?? 0) >= (atual.changedAt ?? 0)) melhor.set(key, p);
    }
  }

  const novos = [...melhor.values()].filter((p) => !playersCache.has(p.playerId)).map((p) => p.playerId);
  if (novos.length) {
    const players = (await req(cfg, `/players?playerIds=${[...new Set(novos)].join(',')}`)) as {
      playerId: number;
      playerName?: string | null;
    }[];
    for (const pl of players) playersCache.set(pl.playerId, (pl.playerName ?? '').trim());
  }

  const mercados: MercadoSugerido[] = [];
  for (const p of melhor.values()) {
    const m = porMarket.get(p.marketId ?? -1);
    if (!m) continue; // mercado sem meta (não é player prop do esporte)
    const jogador = playersCache.get(p.playerId);
    if (!jogador) continue;
    const lado = outcomeDe(m, p.outcomeId);
    const mercadoNome = (m.marketNameShort ?? m.marketName ?? '').trim();
    const descricao = `${jogador.toUpperCase()} — ${(lado || mercadoNome).toUpperCase()}`.slice(0, 80);
    if (p.price > 1 && p.price <= 50) {
      mercados.push({ grupo: 'JOGADORES', descricao, multiplicador: Number(p.price.toFixed(2)) });
    }
  }
  mercados.sort((a, b) => a.multiplicador - b.multiplicador || a.descricao.localeCompare(b.descricao));
  return { mercados, fixtureId: fx.fixtureId };
}
