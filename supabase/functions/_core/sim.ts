import { type Db, num, type Tx } from './db.ts';
import { RuleError } from './errors.ts';
import { isUuid } from './validation.ts';
import { incompativeis, oddTotal } from './compat.ts';
import type { OpcaoCompat } from './compat.ts';

/**
 * Simulador: apostas com dinheiro virtual em mercados reais.
 * Valores em centavos. A apuração é lazy: toda leitura liquida as apostas
 * cujo mercado já foi decidido (decidido_em setado pelo fluxo real de placares).
 */

const MAX_RECARGA = 10_000_000; // R$100 mil virtuais por recarga

async function garantirConta(tx: Tx, userId: string) {
  await tx`insert into sim_conta (user_id) values (${userId}) on conflict do nothing`;
}

/** Liquida sim_apostas abertas cujo mercado foi decidido. Devolve quantas resolveram. */
async function liquidar(tx: Tx, userId: string) {
  const [r] = await tx`
    with r as (
      update sim_aposta a
      set status = case when m.resultado_final then 'ganhou' else 'perdeu' end,
          retorno = case when m.resultado_final then round(a.valor * a.odd)::int else 0 end,
          resolvida_em = now()
      from mercados m
      where a.mercado_id = m.id and a.user_id = ${userId}
        and a.status = 'aberta' and m.decidido_em is not null
      returning a.retorno
    )
    select coalesce(sum(retorno), 0)::int as ganho, count(*)::int as n from r`;
  const ganho = num(r.ganho);
  if (ganho > 0) {
    await tx`
      update sim_conta
      set saldo = saldo + ${ganho}, total_retornado = total_retornado + ${ganho}
      where user_id = ${userId}`;
  }

  // Múltiplas: perde assim que qualquer perna decide contra; ganha quando
  // todas as pernas decidiram a favor.
  const [rm] = await tx`
    with r as (
      update sim_multipla mu
      set status = case
            when exists (
              select 1 from sim_multipla_perna p
              join mercados m on m.id = p.mercado_id
              where p.multipla_id = mu.id
                and m.decidido_em is not null and m.resultado_final = false
            ) then 'perdeu' else 'ganhou' end,
          retorno = case
            when exists (
              select 1 from sim_multipla_perna p
              join mercados m on m.id = p.mercado_id
              where p.multipla_id = mu.id
                and m.decidido_em is not null and m.resultado_final = false
            ) then 0 else round(mu.valor * mu.odd_total)::int end,
          resolvida_em = now()
      where mu.user_id = ${userId} and mu.status = 'aberta'
        and (
          exists (
            select 1 from sim_multipla_perna p
            join mercados m on m.id = p.mercado_id
            where p.multipla_id = mu.id
              and m.decidido_em is not null and m.resultado_final = false
          )
          or not exists (
            select 1 from sim_multipla_perna p
            join mercados m on m.id = p.mercado_id
            where p.multipla_id = mu.id and m.decidido_em is null
          )
        )
      returning mu.retorno
    )
    select coalesce(sum(retorno), 0)::int as ganho, count(*)::int as n from r`;
  const ganhoM = num(rm.ganho);
  if (ganhoM > 0) {
    await tx`
      update sim_conta
      set saldo = saldo + ${ganhoM}, total_retornado = total_retornado + ${ganhoM}
      where user_id = ${userId}`;
  }
  return num(r.n) + num(rm.n);
}

export async function resumo(db: Db, userId: string) {
  return db.begin(async (tx: Tx) => {
    await garantirConta(tx, userId);
    await liquidar(tx, userId);
    const [c] = await tx`select * from sim_conta where user_id = ${userId}`;
    const [ab] = await tx`
      select count(*)::int as n, coalesce(sum(valor), 0)::int as valor from (
        select valor from sim_aposta where user_id = ${userId} and status = 'aberta'
        union all
        select valor from sim_multipla where user_id = ${userId} and status = 'aberta'
      ) t`;
    const [p] = await tx`
      select min(created_at) as primeira from (
        select created_at from sim_aposta where user_id = ${userId}
        union all
        select created_at from sim_multipla where user_id = ${userId}
      ) t`;
    const simples = await tx`
      select a.id, a.valor, a.odd, a.status, a.retorno,
             a.created_at, a.resolvida_em,
             m.descricao as mercado, j.time_casa, j.time_fora
      from sim_aposta a
      join mercados m on m.id = a.mercado_id
      join jogos j on j.id = m.jogo_id
      where a.user_id = ${userId}
      order by a.created_at desc
      limit 50`;
    const multiplas = await tx`
      select mu.id, mu.valor, mu.odd_total, mu.status, mu.retorno,
             mu.created_at, mu.resolvida_em,
             json_agg(
               json_build_object(
                 'mercado', m.descricao,
                 'jogo', j.time_casa || ' x ' || j.time_fora,
                 'odd', p.odd,
                 'status', case
                   when m.decidido_em is null then 'aberta'
                   when m.resultado_final then 'ganhou' else 'perdeu' end
               ) order by m.descricao
             ) as pernas
      from sim_multipla mu
      join sim_multipla_perna p on p.multipla_id = mu.id
      join mercados m on m.id = p.mercado_id
      join jogos j on j.id = m.jogo_id
      where mu.user_id = ${userId}
      group by mu.id
      order by mu.created_at desc
      limit 50`;
    const rows = [
      ...simples.map((a) => ({
        id: a.id as string,
        tipo: 'simples' as const,
        valor: num(a.valor),
        odd: Number(a.odd),
        status: a.status as string,
        retorno: num(a.retorno),
        mercado: a.mercado as string,
        jogo: `${a.time_casa} x ${a.time_fora}`,
        pernas: null,
        created_at: new Date(a.created_at as string).toISOString(),
        resolvida_em: a.resolvida_em ? new Date(a.resolvida_em as string).toISOString() : null,
      })),
      ...multiplas.map((a) => {
        const pernas = a.pernas as { mercado: string; jogo: string; odd: number; status: string }[];
        return {
          id: a.id as string,
          tipo: 'multipla' as const,
          valor: num(a.valor),
          odd: Number(a.odd_total),
          status: a.status as string,
          retorno: num(a.retorno),
          mercado: `Múltipla · ${pernas.length} ${pernas.length === 1 ? 'palpite' : 'palpites'}`,
          jogo: pernas.map((p2) => p2.jogo).join(' + '),
          pernas,
          created_at: new Date(a.created_at as string).toISOString(),
          resolvida_em: a.resolvida_em ? new Date(a.resolvida_em as string).toISOString() : null,
        };
      }),
    ]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 50);

    const saldo = num(c.saldo);
    const depositado = num(c.total_depositado);
    const apostado = num(c.total_apostado);
    const retornado = num(c.total_retornado);
    const abertasN = num(ab.n);
    const abertasValor = num(ab.valor);
    // P&L = saldo + valor das abertas − depositado (abertas contam pelo valor de face).
    const pl = saldo + abertasValor - depositado;
    const dias = p?.primeira
      ? Math.max(1, Math.ceil((Date.now() - new Date(p.primeira as string).getTime()) / 86_400_000))
      : 0;
    const resolvido = apostado - abertasValor;
    const roi = resolvido > 0 ? Math.round(((retornado - resolvido) / resolvido) * 100) : 0;

    return {
      conta: {
        saldo,
        depositado,
        apostado,
        retornado,
        pl,
        roi,
        recargas: num(c.recargas),
        estouros: num(c.estouros),
        abertas_n: abertasN,
        abertas_valor: abertasValor,
        dias,
        projecao_anual: dias ? Math.round((pl * 365) / dias) : 0,
        vs_poupanca: dias ? Math.round((depositado * 0.1 * dias) / 365) : 0,
      },
      apostas: rows,
    };
  });
}

export async function recarga(db: Db, userId: string, input: { valor?: unknown }) {
  const valor = Number(input.valor);
  if (!Number.isInteger(valor) || valor <= 0 || valor > MAX_RECARGA) {
    throw new RuleError('Valor inválido.');
  }
  return db.begin(async (tx: Tx) => {
    await garantirConta(tx, userId);
    const [c] = await tx`select saldo, total_depositado from sim_conta where user_id = ${userId} for update`;
    // "Estouro": recarrega com a banca zerada depois de já ter perdido dinheiro.
    const estourou = num(c.saldo) === 0 && num(c.total_depositado) > 0;
    await tx`insert into sim_recarga (user_id, valor) values (${userId}, ${valor})`;
    await tx`
      update sim_conta
      set saldo = saldo + ${valor},
          total_depositado = total_depositado + ${valor},
          recargas = recargas + 1,
          estouros = estouros + ${estourou ? 1 : 0}
      where user_id = ${userId}`;
    return { estourou };
  });
}

export async function apostar(
  db: Db,
  userId: string,
  input: { mercado_id?: unknown; mercado_ids?: unknown; valor?: unknown },
) {
  // Aceita mercado_ids[] (1 = simples, 2+ = múltipla) ou o formato antigo mercado_id.
  const brutos = Array.isArray(input.mercado_ids)
    ? input.mercado_ids
    : input.mercado_id
      ? [input.mercado_id]
      : [];
  const ids = brutos.map((id) => String(id).toLowerCase());
  if (!ids.length || !ids.every(isUuid)) throw new RuleError('Mercado inválido.');
  if (new Set(ids).size !== ids.length) throw new RuleError('Palpite repetido no bilhete.');
  const valor = Number(input.valor);
  if (!Number.isInteger(valor) || valor <= 0) throw new RuleError('Valor inválido.');
  return db.begin(async (tx: Tx) => {
    await garantirConta(tx, userId);
    const [c] = await tx`select saldo from sim_conta where user_id = ${userId} for update`;
    if (num(c.saldo) < valor) throw new RuleError('Saldo insuficiente. Recarregue a banca virtual.');
    const mercados = await tx`
      select m.id, m.grupo, m.descricao, m.multiplicador, m.jogo_id,
             m.decidido_em, m.oculto,
             j.time_casa, j.time_fora, j.finalizado_em,
             j.horario <= now() as comecou, l.status as liga_status
      from mercados m
      join jogos j on j.id = m.jogo_id
      join ligas l on l.id = j.liga_id
      where m.id in ${tx(ids)}`;
    if (mercados.length !== ids.length) throw new RuleError('Mercado inválido.');
    if (
      mercados.some(
        (m) =>
          m.decidido_em != null || m.oculto ||
          m.finalizado_em != null || m.comecou || m.liga_status === 'finalizada',
      )
    ) {
      throw new RuleError('Esse mercado já fechou.');
    }

    if (ids.length === 1) {
      const m = mercados[0];
      const odd = Number(m.multiplicador);
      await tx`insert into sim_aposta (user_id, mercado_id, valor, odd) values (${userId}, ${m.id}, ${valor}, ${odd})`;
    } else {
      const ops: OpcaoCompat[] = mercados.map((m) => ({
        jogo_id: m.jogo_id as string,
        time_casa: m.time_casa as string,
        time_fora: m.time_fora as string,
        grupo: (m.grupo as string) ?? '',
        descricao: m.descricao as string,
      }));
      for (let i = 0; i < ops.length; i++) {
        for (let k = i + 1; k < ops.length; k++) {
          if (incompativeis(ops[i], ops[k])) throw new RuleError('Evento incompatível na múltipla.');
        }
      }
      const total = oddTotal(mercados.map((m) => Number(m.multiplicador)));
      const [mu] = await tx`
        insert into sim_multipla (user_id, valor, odd_total) values (${userId}, ${valor}, ${total})
        returning id`;
      const pernas = mercados.map((m) => ({
        multipla_id: mu.id,
        mercado_id: m.id,
        odd: Number(m.multiplicador),
      }));
      await tx`insert into sim_multipla_perna ${tx(pernas, 'multipla_id', 'mercado_id', 'odd')}`;
    }
    await tx`
      update sim_conta
      set saldo = saldo - ${valor}, total_apostado = total_apostado + ${valor}
      where user_id = ${userId}`;
    return { ok: true };
  });
}
