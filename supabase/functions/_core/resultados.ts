import { decidido, type ExDados, predicado, predicadoEx } from './compat.ts';
import { type Db, num, type Tx } from './db.ts';
import { NotFoundError, RuleError } from './errors.ts';
import { type OddsConfig, placarDoJogo as placarDaApi } from './odds.ts';
import { isUuid } from './validation.ts';


const par = (v: unknown): [number, number] | undefined => {
  if (v == null || v === '') return undefined;
  if (!Array.isArray(v) || v.length !== 2) throw new RuleError('Estatística inválida.');
  const [a, b] = v.map(Number);
  if (![a, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 99)) throw new RuleError('Estatística inválida.');
  return [a, b];
};

/** Estatísticas pós-jogo enviadas pelo admin: cada uma [casa, fora]; ausente = não informada. */
export const extrasDoCorpo = (b: Record<string, unknown>): ExDados => {
  const ex: ExDados = {};
  for (const k of ['gols1t', 'escanteios', 'escanteios1t', 'cartoes'] as const) {
    const v = par(b[k]);
    if (v) ex[k] = v;
  }
  return ex;
};

/** Grava o placar final e marca os mercados do jogo que bateram (pelo placar). */
export async function aplicarPlacar(sql: Db, jogoId: string, casa: number, fora: number, extra?: ExDados) {
  if (!isUuid(jogoId)) throw new NotFoundError('Jogo não encontrado.');
  if (![casa, fora].every((n) => Number.isInteger(n) && n >= 0)) throw new RuleError('Placar inválido.');
  return sql.begin(async (tx: Tx) => {
    const [j] = await tx`
      select j.id, j.time_casa, j.time_fora, j.estatisticas, l.status from jogos j join ligas l on l.id = j.liga_id
      where j.id = ${jogoId} for update of j`;
    if (!j) throw new NotFoundError('Jogo não encontrado.');
    if (j.status === 'finalizada') throw new RuleError('Palpite já finalizado.');
    // Estatísticas já informadas (ex.: escanteios pelo admin) valem junto com as novas.
    const salvas: ExDados = { ...((j.estatisticas as ExDados | null) ?? {}), ...(extra ?? {}) };
    delete salvas.placar;
    const ex: ExDados = { ...salvas, placar: [casa, fora] };
    await tx`
      update jogos set placar_casa = ${casa}, placar_fora = ${fora}, finalizado_em = coalesce(finalizado_em, now()),
             estatisticas = ${tx.json(salvas as never)}
      where id = ${jogoId}`;
    const mercados = await tx`select id, grupo, descricao from mercados where jogo_id = ${jogoId}`;
    let marcados = 0;
    for (const m of mercados) {
      const o = {
        jogo_id: jogoId,
        time_casa: j.time_casa as string,
        time_fora: j.time_fora as string,
        grupo: (m.grupo as string) ?? '',
        descricao: m.descricao as string,
      };
      const p = predicado(o);
      const px = p ? null : predicadoEx(o);
      if (!p && !px) continue;
      const bateu = p ? p(casa, fora) : px!(ex);
      if (bateu == null) continue; // a API não mandou a estatística: fica pra finalização manual
      // Empate anula: no empate o palpite é anulado e as fichas voltam (odd 1.0).
      const anulado = casa === fora && String(m.grupo ?? '').toUpperCase().startsWith('EMPATE ANULA');
      if (bateu && !anulado) marcados++;
      await tx`update mercados set resultado_final = ${bateu || anulado}, anulado = ${anulado},
               decidido_em = coalesce(decidido_em, now()) where id = ${m.id}`;
    }
    return { jogo_id: jogoId, placar: [casa, fora] as const, mercados_certos: marcados };
  });
}

/** Placar parcial: grava o placar ao vivo e marca só os mercados que já não podem mudar. */
export async function aplicarParcial(sql: Db, jogoId: string, casa: number, fora: number) {
  return sql.begin(async (tx: Tx) => {
    const [j] = await tx`
      select id, time_casa, time_fora from jogos where id = ${jogoId} and finalizado_em is null for update`;
    if (!j) return 0;
    await tx`update jogos set placar_casa = ${casa}, placar_fora = ${fora} where id = ${jogoId}`;
    const mercados = await tx`select id, grupo, descricao from mercados where jogo_id = ${jogoId} and decidido_em is null`;
    let n = 0;
    for (const m of mercados) {
      const p = predicado({
        jogo_id: jogoId,
        time_casa: j.time_casa as string,
        time_fora: j.time_fora as string,
        grupo: (m.grupo as string) ?? '',
        descricao: m.descricao as string,
      });
      const v = p ? decidido(p, casa, fora) : null;
      if (v == null) continue;
      n++;
      await tx`update mercados set resultado_final = ${v}, decidido_em = now() where id = ${m.id}`;
    }
    return n;
  });
}

/**
 * Busca na OddsPapi o placar dos jogos da rodada que já começaram e ainda não terminaram.
 * Sem jogo rolando, não chama a API (não gasta crédito). Cada jogo consultado custa 1 request.
 */
export async function atualizarResultados(sql: Db, cfg: OddsConfig | undefined) {
  await fecharApostasIniciadas(sql);
  const pendentes = await sql`
    select j.id, f.externo_id, f.data
    from jogos j
    join ligas l on l.id = j.liga_id
    join fixtures_dia f on f.fixture_id = j.fixture_id
    where l.status <> 'finalizada' and j.finalizado_em is null and f.externo_id is not null and f.fonte = 'oddspapi'
      and j.horario <= now() and j.horario > now() - interval '3 days'`;
  // Sem jogo pendente, zero requests.
  if (pendentes.length === 0) return { consultados: 0, finalizados: [], mercados_decididos: 0, creditos_restantes: null };
  if (!cfg?.apiKey) throw new RuleError('Integração de odds não configurada (ODDS_PAPI_KEY).');

  // 1 request por jogo pendente. O placar da OddsPapi só traz gols (jogo e 1º tempo):
  // escanteios e cartões o admin informa depois do jogo (POST /admin/jogos/:id/placar).
  const finalizados = [];
  let decididos = 0;
  const restantes: number | null = null;
  for (const jogo of pendentes) {
    let ev;
    try {
      ev = await placarDaApi(cfg, String(jogo.externo_id));
    } catch (e) {
      console.error('[resultados] falha', jogo.externo_id, e);
      continue;
    }
    if (!ev) continue;
    const { casa, fora } = ev;
    if (![casa, fora].every((n) => Number.isInteger(n) && n >= 0)) continue;
    if (ev.status === 'finished') {
      const extra: ExDados = {
        gols1t: ev.casa1t != null && ev.fora1t != null ? [ev.casa1t, ev.fora1t] : undefined,
      };
      finalizados.push(await aplicarPlacar(sql, jogo.id as string, casa, fora, extra));
    } else if (ev.status === 'live') decididos += await aplicarParcial(sql, jogo.id as string, casa, fora);
  }
  // Desafios fecham sozinhos quando todos os jogos já têm placar final.
  await sql`
    update ligas l set status = 'finalizada', finalizada_em = coalesce(finalizada_em, now())
    where l.owner_id is not null and l.status <> 'finalizada'
      and exists (select 1 from jogos j where j.liga_id = l.id)
      and not exists (select 1 from jogos j where j.liga_id = l.id and j.finalizado_em is null)`;
  return { consultados: pendentes.length, finalizados, mercados_decididos: decididos, creditos_restantes: restantes };
}

export const placarDoJogo = (j: Record<string, unknown>) =>
  j.placar_casa == null ? null : { casa: num(j.placar_casa), fora: num(j.placar_fora) };

/** Fecha as apostas das rodadas abertas cujo último jogo já começou. */
export async function fecharApostasIniciadas(sql: Db) {
  const r = await sql`
    update ligas l set status = 'em_andamento'
    where l.status = 'aberta'
      and exists (select 1 from jogos j where j.liga_id = l.id)
      and not exists (select 1 from jogos j where j.liga_id = l.id and j.horario > now())
    returning l.id`;
  return r.length;
}
