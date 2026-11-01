import { predicado } from './compat.ts';
import { type Db, num, type Tx } from './db.ts';
import { NotFoundError, RuleError } from './errors.ts';
import { ESPORTES_PADRAO, type OddsConfig } from './odds.ts';
import { isUuid } from './validation.ts';

type Score = {
  id: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
};

/** Grava o placar final e marca os mercados do jogo que bateram (pelo placar). */
export async function aplicarPlacar(sql: Db, jogoId: string, casa: number, fora: number) {
  if (!isUuid(jogoId)) throw new NotFoundError('Jogo não encontrado.');
  if (![casa, fora].every((n) => Number.isInteger(n) && n >= 0)) throw new RuleError('Placar inválido.');
  return sql.begin(async (tx: Tx) => {
    const [j] = await tx`
      select j.id, j.time_casa, j.time_fora, l.status from jogos j join ligas l on l.id = j.liga_id
      where j.id = ${jogoId} for update of j`;
    if (!j) throw new NotFoundError('Jogo não encontrado.');
    if (j.status === 'finalizada') throw new RuleError('Palpite já finalizado.');
    await tx`
      update jogos set placar_casa = ${casa}, placar_fora = ${fora}, finalizado_em = coalesce(finalizado_em, now())
      where id = ${jogoId}`;
    const mercados = await tx`select id, grupo, descricao from mercados where jogo_id = ${jogoId}`;
    let marcados = 0;
    for (const m of mercados) {
      const p = predicado({
        jogo_id: jogoId,
        time_casa: j.time_casa as string,
        time_fora: j.time_fora as string,
        grupo: (m.grupo as string) ?? '',
        descricao: m.descricao as string,
      });
      if (!p) continue;
      const bateu = p(casa, fora);
      if (bateu) marcados++;
      await tx`update mercados set resultado_final = ${bateu} where id = ${m.id}`;
    }
    return { jogo_id: jogoId, placar: [casa, fora] as const, mercados_certos: marcados };
  });
}

/**
 * Busca na The Odds API o placar dos jogos da rodada que já começaram e ainda não terminaram.
 * Sem jogo rolando, não chama a API (não gasta crédito). Cada campeonato consultado custa 2 créditos.
 */
export async function atualizarResultados(sql: Db, cfg: OddsConfig | undefined) {
  const pendentes = await sql`
    select j.id, j.time_casa, j.time_fora, f.externo_id, f.externo_esporte
    from jogos j
    join ligas l on l.id = j.liga_id
    join fixtures_dia f on f.fixture_id = j.fixture_id
    where l.status <> 'finalizada' and j.finalizado_em is null and f.externo_id is not null
      and j.horario <= now() and j.horario > now() - interval '3 days'`;
  if (pendentes.length === 0) return { consultados: 0, finalizados: [], creditos_restantes: null };
  if (!cfg?.apiKey) throw new RuleError('Integração de odds não configurada (THE_ODDS_API_KEY).');

  const porEsporte = new Map<string, Record<string, unknown>[]>();
  for (const p of pendentes) {
    const e = (p.externo_esporte as string | null) ?? ESPORTES_PADRAO[0];
    porEsporte.set(e, [...(porEsporte.get(e) ?? []), p]);
  }
  const finalizados = [];
  let restantes: number | null = null;
  for (const [esporte, jogos] of porEsporte) {
    const ids = jogos.map((j) => j.externo_id as string).join(',');
    const url =
      `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(esporte)}/scores/?apiKey=${encodeURIComponent(cfg.apiKey)}` +
      `&daysFrom=1&dateFormat=iso&eventIds=${encodeURIComponent(ids)}`;
    const res = await (cfg.fetch ?? fetch)(url);
    if (!res.ok) {
      console.error('[resultados] falha', esporte, res.status, (await res.text().catch(() => '')).slice(0, 200));
      continue;
    }
    const r = res.headers.get('x-requests-remaining');
    if (r != null) restantes = Number(r);
    const eventos = (await res.json()) as Score[];
    for (const ev of eventos) {
      if (!ev.completed || !ev.scores) continue;
      const jogo = jogos.find((j) => j.externo_id === ev.id);
      if (!jogo) continue;
      const gols = (time: string) => ev.scores!.find((s) => s.name === time)?.score;
      const casa = Number(gols(ev.home_team));
      const fora = Number(gols(ev.away_team));
      if (!Number.isInteger(casa) || !Number.isInteger(fora)) continue;
      finalizados.push(await aplicarPlacar(sql, jogo.id as string, casa, fora));
    }
  }
  return { consultados: pendentes.length, finalizados, creditos_restantes: restantes };
}

export const placarDoJogo = (j: Record<string, unknown>) =>
  j.placar_casa == null ? null : { casa: num(j.placar_casa), fora: num(j.placar_fora) };
