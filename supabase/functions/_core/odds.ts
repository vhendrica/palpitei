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
  bookmakers: { key?: string; markets: { key: string; outcomes: Outcome[] }[] }[];
};
export type MercadoSugerido = { grupo: string; descricao: string; multiplicador: number };

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
  const op: Record<string, [string, string]> = {
    CASA: ['RESULTADO', e.home_team.toUpperCase()],
    EMPATE: ['RESULTADO', 'EMPATE'],
    FORA: ['RESULTADO', e.away_team.toUpperCase()],
    OVER: [`GOLS ${LINHA_GOLS}`, `MAIS DE ${LINHA_GOLS}`],
    UNDER: [`GOLS ${LINHA_GOLS}`, `MENOS DE ${LINHA_GOLS}`],
  };
  return Object.keys(op)
    .filter((k) => precos.get(k)?.length)
    .map((k) => ({
      grupo: op[k][0],
      descricao: op[k][1],
      multiplicador: Math.max(1.01, Math.round(mediana(precos.get(k)!) * 100) / 100),
    }));
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
                                  externo_esporte, mercados_sugeridos, odds_atualizadas_em)
        values (${fixtureIdDoEvento(e.id)}, ${data}, ${e.home_team}, ${e.away_team}, ${e.commence_time},
                ${NOMES[e.sport_key] ?? e.sport_title}, 'the_odds_api', ${e.id}, ${e.sport_key}, ${db.json(mercados)}, now())
        on conflict (externo_id) do update set
          data = excluded.data, time_casa = excluded.time_casa, time_fora = excluded.time_fora,
          horario = excluded.horario, campeonato = excluded.campeonato,
          externo_esporte = excluded.externo_esporte,
          mercados_sugeridos = excluded.mercados_sugeridos, odds_atualizadas_em = now()
        returning fixture_id`;
      importados.push({ fixture_id: Number(row.fixture_id), time_casa: e.home_team, time_fora: e.away_team, mercados: mercados.length });
    }
  }
  return { importados, creditos_restantes: restantes };
}

export type MercadoApi = MercadoSugerido & { casas: number };
const MERCADOS_EXTRAS = ['btts', 'double_chance', 'draw_no_bet', 'alternate_totals'];
const GRUPOS: Record<string, string> = {
  btts: 'AMBOS MARCAM',
  double_chance: 'DUPLA CHANCE',
  draw_no_bet: 'EMPATE ANULA',
  alternate_totals: 'GOLS',
};

/** Odds dos mercados extras de um evento: Pinnacle como referência; sem ela, mediana das casas. */
export function mercadosExtrasDoEvento(e: Evento): MercadoApi[] {
  const nome = (n: string) => (n === 'Draw' ? 'EMPATE' : n.toUpperCase());
  const acc = new Map<string, { grupo: string; descricao: string; ordem: number; precos: number[]; pinnacle?: number }>();
  for (const b of e.bookmakers) {
    for (const m of b.markets) {
      if (!GRUPOS[m.key]) continue;
      for (const o of m.outcomes) {
        let descricao: string;
        let grupo = GRUPOS[m.key];
        let ordem = MERCADOS_EXTRAS.indexOf(m.key) * 1000;
        if (m.key === 'btts') {
          descricao = o.name === 'Yes' ? 'SIM' : 'NÃO';
          ordem += o.name === 'Yes' ? 0 : 1;
        } else if (m.key === 'double_chance') {
          descricao = o.name.split(' or ').map(nome).join(' OU ');
          ordem += descricao.includes('EMPATE') ? (descricao.includes(e.home_team.toUpperCase()) ? 0 : 1) : 2;
        } else if (m.key === 'draw_no_bet') {
          descricao = nome(o.name);
          ordem += o.name === e.home_team ? 0 : 1;
        } else {
          // Só linhas .5: no PALPIT não existe devolução (push) de linha inteira/asiática.
          if (o.point == null || Math.abs((o.point % 1) - 0.5) > 1e-9) continue;
          grupo = `GOLS ${o.point}`;
          descricao = `${o.name === 'Over' ? 'MAIS' : 'MENOS'} DE ${o.point}`;
          ordem += o.point * 10 + (o.name === 'Over' ? 0 : 1);
        }
        const k = `${grupo}|${descricao}`;
        const item = acc.get(k) ?? { grupo, descricao, ordem, precos: [] };
        item.precos.push(o.price);
        if (b.key === 'pinnacle') item.pinnacle = o.price;
        acc.set(k, item);
      }
    }
  }
  return [...acc.values()]
    .sort((a, b) => a.ordem - b.ordem)
    .map((i) => ({
      grupo: i.grupo,
      descricao: i.descricao,
      multiplicador: Math.max(1.01, Math.round((i.pinnacle ?? mediana(i.precos)) * 100) / 100),
      casas: i.precos.length,
    }));
}

/** Busca na The Odds API os mercados extras de um jogo da múltipla (custa 4 créditos por chamada). */
export async function mercadosDaApi(db: Db, cfg: OddsConfig | undefined, jogoId: string) {
  if (!cfg?.apiKey) throw new RuleError('Integração de odds não configurada (THE_ODDS_API_KEY).');
  if (!/^[0-9a-f-]{36}$/i.test(jogoId)) throw new RuleError('Jogo não encontrado.');
  const [j] = await db`
    select f.externo_id, f.externo_esporte from jogos j
    left join fixtures_dia f on f.fixture_id = j.fixture_id
    where j.id = ${jogoId}`;
  if (!j) throw new RuleError('Jogo não encontrado.');
  if (!j.externo_id) throw new RuleError('Esse jogo foi cadastrado na mão; não há odds da API para ele.');
  const esporte = (j.externo_esporte as string | null) ?? ESPORTES_PADRAO[0];
  const url =
    `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(esporte)}/events/${encodeURIComponent(j.externo_id)}/odds` +
    `?apiKey=${encodeURIComponent(cfg.apiKey)}&regions=eu&markets=${MERCADOS_EXTRAS.join(',')}&oddsFormat=decimal`;
  const res = await (cfg.fetch ?? fetch)(url);
  if (!res.ok) {
    console.error('[odds] falha extras', res.status, (await res.text().catch(() => '')).slice(0, 200));
    if (res.status === 404) throw new RuleError('A API não tem mais esse jogo (já começou ou foi removido).');
    throw new RuleError(res.status === 401 ? 'Chave da The Odds API inválida ou sem créditos.' : 'Falha ao buscar odds. Tente de novo.');
  }
  const r = res.headers.get('x-requests-remaining');
  return { mercados: mercadosExtrasDoEvento((await res.json()) as Evento), creditos_restantes: r == null ? null : Number(r) };
}
