import { decidido, type ExDados, predicado, predicadoEx } from './compat.ts';
import { type Db, num, type Tx } from './db.ts';
import { NotFoundError, RuleError } from './errors.ts';
import { type FixtureApi, fixturesDoDia, type OddsConfig } from './odds.ts';
import { isUuid } from './validation.ts';


/** Grava o placar final e marca os mercados do jogo que bateram (pelo placar). */
export async function aplicarPlacar(sql: Db, jogoId: string, casa: number, fora: number, extra?: ExDados) {
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
      if (!p && !extra) continue; // mercado de escanteios/cartões/1º tempo sem dado: fica pra finalização manual
      const bateu = p ? p(casa, fora) : px!(extra!);
      if (bateu) marcados++;
      await tx`update mercados set resultado_final = ${bateu}, decidido_em = coalesce(decidido_em, now()) where id = ${m.id}`;
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
 * Busca na The Odds API o placar dos jogos da rodada que já começaram e ainda não terminaram.
 * Sem jogo rolando, não chama a API (não gasta crédito). Cada campeonato consultado custa 2 créditos.
 */
export async function atualizarResultados(sql: Db, cfg: OddsConfig | undefined) {
  await fecharApostasIniciadas(sql);
  const pendentes = await sql`
    select j.id, f.externo_id, f.data
    from jogos j
    join ligas l on l.id = j.liga_id
    join fixtures_dia f on f.fixture_id = j.fixture_id
    where l.status <> 'finalizada' and j.finalizado_em is null and f.externo_id is not null
      and j.horario <= now() and j.horario > now() - interval '3 days'`;
  // Sem jogo pendente, zero requests (plano FREE = 60/hora).
  if (pendentes.length === 0) return { consultados: 0, finalizados: [], mercados_decididos: 0, creditos_restantes: null };
  if (!cfg?.apiKey) throw new RuleError('Integração de futebol não configurada (FOOTBALL_API_KEY).');

  // 1 request por data com jogo pendente (quase sempre 1) — a janela traz live + finished juntos.
  const porData = new Map<string, Record<string, unknown>[]>();
  for (const p of pendentes) {
    const d = (p.data instanceof Date ? p.data.toISOString() : String(p.data)).slice(0, 10);
    porData.set(d, [...(porData.get(d) ?? []), p]);
  }
  const finalizados = [];
  let decididos = 0;
  const restantes: number | null = null;
  for (const jogos of porData.values()) {
    const data = (jogos[0].data instanceof Date ? jogos[0].data.toISOString() : String(jogos[0].data)).slice(0, 10);
    let lista: FixtureApi[];
    try {
      lista = await fixturesDoDia(cfg, data);
    } catch (e) {
      console.error('[resultados] falha', data, e);
      continue;
    }
    for (const ev of lista) {
      const jogo = jogos.find((j) => j.externo_id === String(ev.id));
      if (!jogo || !ev.goals) continue;
      const casa = Number(ev.goals.home);
      const fora = Number(ev.goals.away);
      if (!Number.isInteger(casa) || !Number.isInteger(fora) || casa < 0 || fora < 0) continue;
      const extra: ExDados = {
        gols1t:
          ev.goals.half_home != null && ev.goals.half_away != null
            ? [ev.goals.half_home, ev.goals.half_away]
            : undefined,
        escanteios: ev.corners ? [ev.corners.home, ev.corners.away] : undefined,
        escanteios1t:
          ev.corners?.half_home != null && ev.corners.half_away != null
            ? [ev.corners.half_home, ev.corners.half_away]
            : undefined,
        cartoes: ev.cards ? [ev.cards.home.yellow + ev.cards.home.red, ev.cards.away.yellow + ev.cards.away.red] : undefined,
      };
      if (ev.status === 'finished') finalizados.push(await aplicarPlacar(sql, jogo.id as string, casa, fora, extra));
      else if (ev.status === 'live') decididos += await aplicarParcial(sql, jogo.id as string, casa, fora);
    }
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
