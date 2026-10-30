import type { Db } from './db.ts';
import { RuleError } from './errors.ts';
import { validarDataISO } from './validation.ts';

/** Integração com a The Odds API (https://the-odds-api.com/liveapi/guides/v4/). Cada import custa markets×regions créditos por campeonato. */
export type OddsConfig = { apiKey: string; esportes?: string[]; fetch?: typeof fetch };

export const ESPORTES_PADRAO = ['soccer_brazil_campeonato'];
const NOMES: Record<string, string> = {
  soccer_brazil_campeonato: 'Brasileirão Série A',
  soccer_brazil_serie_b: 'Brasileirão Série B',
  soccer_conmebol_copa_libertadores: 'Libertadores',
  soccer_conmebol_copa_sudamericana: 'Sul-Americana',
};
const TZ = 'America/Fortaleza';
const LINHA_GOLS = 2.5;

type Outcome = { name: string; price: number; point?: number };
type Evento = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: { markets: { key: string; outcomes: Outcome[] }[] }[];
};
export type MercadoSugerido = { descricao: string; multiplicador: number };

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Mediana das casas para vitória/empate/vitória e mais/menos de 2.5 gols. */
export function mercadosDoEvento(e: Evento): MercadoSugerido[] {
  const precos = new Map<string, number[]>();
  const add = (k: string, p: number) => precos.set(k, [...(precos.get(k) ?? []), p]);
  for (const b of e.bookmakers) {
    for (const m of b.markets) {
      for (const o of m.outcomes) {
        if (m.key === 'h2h') add(o.name === 'Draw' ? 'EMPATE' : o.name === e.home_team ? 'CASA' : 'FORA', o.price);
        if (m.key === 'totals' && o.point === LINHA_GOLS) add(o.name === 'Over' ? 'OVER' : 'UNDER', o.price);
      }
    }
  }
  const desc: Record<string, string> = {
    CASA: `VITÓRIA ${e.home_team}`.toUpperCase(),
    EMPATE: 'EMPATE',
    FORA: `VITÓRIA ${e.away_team}`.toUpperCase(),
    OVER: `MAIS DE ${LINHA_GOLS} GOLS`,
    UNDER: `MENOS DE ${LINHA_GOLS} GOLS`,
  };
  return Object.keys(desc)
    .filter((k) => precos.get(k)?.length)
    .map((k) => ({ descricao: desc[k], multiplicador: Math.max(1.01, Math.round(mediana(precos.get(k)!) * 100) / 100) }));
}

/** fixture_id numérico estável a partir do id hex do evento (cabe em bigint/Number). */
export const fixtureIdDoEvento = (id: string) => parseInt(id.replace(/[^0-9a-f]/gi, '').slice(0, 13), 16);

/** Busca jogos+odds do dia na The Odds API e faz upsert no pool (fixtures_dia). */
export async function importarOdds(db: Db, cfg: OddsConfig | undefined, dataInput: unknown) {
  if (!cfg?.apiKey) throw new RuleError('Integração de odds não configurada (THE_ODDS_API_KEY).');
  const data = validarDataISO(dataInput);
  const f = cfg.fetch ?? fetch;
  let restantes: number | null = null;
  const importados = [];
  for (const esporte of cfg.esportes?.length ? cfg.esportes : ESPORTES_PADRAO) {
    const url =
      `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(esporte)}/odds?apiKey=${encodeURIComponent(cfg.apiKey)}` +
      '&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso';
    const res = await f(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[odds] falha', esporte, res.status, body.slice(0, 200));
      throw new RuleError(res.status === 401 ? 'Chave da The Odds API inválida ou sem créditos.' : 'Falha ao buscar odds. Tente de novo.');
    }
    const r = res.headers.get('x-requests-remaining');
    if (r != null) restantes = Number(r);
    const eventos = (await res.json()) as Evento[];
    for (const e of eventos) {
      if (new Date(e.commence_time).toLocaleDateString('en-CA', { timeZone: TZ }) !== data) continue;
      const mercados = mercadosDoEvento(e);
      const [row] = await db`
        insert into fixtures_dia (fixture_id, data, time_casa, time_fora, horario, campeonato, fonte, externo_id,
                                  mercados_sugeridos, odds_atualizadas_em)
        values (${fixtureIdDoEvento(e.id)}, ${data}, ${e.home_team}, ${e.away_team}, ${e.commence_time},
                ${NOMES[e.sport_key] ?? e.sport_title}, 'the_odds_api', ${e.id}, ${db.json(mercados)}, now())
        on conflict (externo_id) do update set
          data = excluded.data, time_casa = excluded.time_casa, time_fora = excluded.time_fora,
          horario = excluded.horario, campeonato = excluded.campeonato,
          mercados_sugeridos = excluded.mercados_sugeridos, odds_atualizadas_em = now()
        returning fixture_id`;
      importados.push({ fixture_id: Number(row.fixture_id), time_casa: e.home_team, time_fora: e.away_team, mercados: mercados.length });
    }
  }
  return { importados, creditos_restantes: restantes };
}
