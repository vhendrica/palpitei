import { type Db, iso, num, type Tx } from './db.ts';
import { NotFoundError, RuleError } from './errors.ts';
import { validarEscada } from './premio.ts';
import { getEscada, getLiga, getLigaPorData } from './rules.ts';
import { getConfig, jogosComMercados } from './services.ts';
import { isUuid, validarDataISO } from './validation.ts';

const inteiroPositivo = (v: unknown, campo: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new RuleError(`${campo} inválido.`);
  return n;
};

const inteiroNaoNegativo = (v: unknown, campo: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new RuleError(`${campo} inválido.`);
  return n;
};

const texto = (v: unknown, campo: string, max = 80) => {
  const s = String(v ?? '').trim();
  if (!s || s.length > max) throw new RuleError(`${campo} inválido.`);
  return s;
};

export async function configAdmin(db: Db) {
  return { config: await getConfig(db), premio_escada: await getEscada(db) };
}

export async function atualizarConfig(db: Db, input: Record<string, unknown>) {
  const atual = await getConfig(db);
  const qtd = input.qtd_jogos_dia == null ? atual.qtd_jogos_dia : inteiroPositivo(input.qtd_jogos_dia, 'Quantidade de jogos');
  const fichas =
    input.fichas_por_entrada == null ? atual.fichas_por_entrada : inteiroPositivo(input.fichas_por_entrada, 'Fichas por entrada');
  const custo =
    input.custo_entrada_pontos == null ? atual.custo_entrada_pontos : inteiroPositivo(input.custo_entrada_pontos, 'Custo de entrada');
  const boas =
    input.pontos_boas_vindas == null ? atual.pontos_boas_vindas : inteiroNaoNegativo(input.pontos_boas_vindas, 'Bônus de cadastro');
  let inicial = atual.premio_inicial;
  if (input.premio_inicial != null) {
    inicial = Number(input.premio_inicial);
    if (!Number.isFinite(inicial) || inicial < 0) throw new RuleError('Prêmio inicial inválido.');
    const [primeira] = await getEscada(db);
    if (primeira && primeira.valor <= inicial) throw new RuleError('O prêmio inicial precisa ser menor que a 1ª faixa da escada.');
  }
  await db`
    update config set qtd_jogos_dia = ${qtd}, fichas_por_entrada = ${fichas}, custo_entrada_pontos = ${custo},
                      pontos_boas_vindas = ${boas}, premio_inicial = ${inicial}, updated_at = now()
    where id = 1`;
  return configAdmin(db);
}

/** Substitui a escada inteira. A ordem do array é a ordem das faixas; a última é a META/TETO. */
export async function salvarPremioEscada(sql: Db, faixasInput: unknown) {
  if (!Array.isArray(faixasInput)) throw new RuleError('Envie a lista de faixas.');
  const faixas = faixasInput.map((f) => ({ usuarios_min: Number(f?.usuarios_min), valor: Number(f?.valor) }));
  const erro = validarEscada(faixas, (await getConfig(sql)).premio_inicial);
  if (erro) throw new RuleError(erro);
  await sql.begin(async (tx: Tx) => {
    await tx`delete from premio_escada`;
    await tx`insert into premio_escada ${tx(faixas.map((f, i) => ({ ...f, ordem: i + 1 })), 'ordem', 'usuarios_min', 'valor')}`;
  });
  return getEscada(sql);
}

const mapFixture = (f: Record<string, unknown>) => ({
  id: f.id as string,
  fixture_id: num(f.fixture_id),
  data: iso(f.data as Date)!.slice(0, 10),
  time_casa: f.time_casa as string,
  time_fora: f.time_fora as string,
  horario: iso(f.horario as Date)!,
  campeonato: f.campeonato as string,
  selecionado: !!f.selecionado,
  fonte: (f.fonte as string) ?? 'manual',
  mercados_sugeridos: (f.mercados_sugeridos ?? []) as { grupo?: string; descricao: string; multiplicador: number }[],
});

export async function listarFixtures(db: Db, data: string) {
  const rows = await db`select * from fixtures_dia where data = ${validarDataISO(data)} order by horario, time_casa`;
  return rows.map(mapFixture);
}

/** Fase 1: o pool é alimentado manualmente. Fase 2: o job da API-Football faz upsert por fixture_id aqui. */
export async function upsertFixture(db: Db, input: Record<string, unknown>) {
  const fixtureId = inteiroPositivo(input.fixture_id, 'fixture_id');
  const horario = new Date(String(input.horario ?? ''));
  if (Number.isNaN(horario.getTime())) throw new RuleError('Horário inválido.');
  const data = input.data ? validarDataISO(input.data) : horario.toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' });
  const [f] = await db`
    insert into fixtures_dia (fixture_id, data, time_casa, time_fora, horario, campeonato)
    values (${fixtureId}, ${data}, ${texto(input.time_casa, 'Time da casa')}, ${texto(input.time_fora, 'Time visitante')},
            ${horario}, ${texto(input.campeonato, 'Campeonato')})
    on conflict (fixture_id) do update set
      data = excluded.data, time_casa = excluded.time_casa, time_fora = excluded.time_fora,
      horario = excluded.horario, campeonato = excluded.campeonato
    returning *`;
  return mapFixture(f);
}

export async function removerFixture(db: Db, id: string) {
  if (!isUuid(id)) throw new NotFoundError('Jogo não encontrado.');
  const [f] = await db`delete from fixtures_dia where id = ${id} and not selecionado returning id`;
  if (!f) throw new RuleError('Jogo não encontrado ou já selecionado para a múltipla.');
}

/**
 * Monta a múltipla do dia com os jogos escolhidos do pool (1 ou mais; o admin decide quantos). Cria a liga se não existir.
 * Mantém jogos (e mercados) que continuam selecionados. Bloqueado depois que alguém entrou.
 */
export async function selecionarJogos(sql: Db, input: { data: unknown; fixture_ids: unknown; premio_desc?: unknown }) {
  const data = validarDataISO(input.data);
  if (!Array.isArray(input.fixture_ids)) throw new RuleError('Envie os jogos selecionados.');
  const ids = [...new Set(input.fixture_ids.map((x) => Number(x)))];
  if (ids.length === 0 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new RuleError('Selecione pelo menos 1 jogo.');
  const config = await getConfig(sql);

  const ligaId = await sql.begin(async (tx: Tx) => {
    const pool = await tx`select * from fixtures_dia where data = ${data} and fixture_id in ${tx(ids)}`;
    if (pool.length !== ids.length) throw new RuleError('Jogo fora do pool desse dia.');

    let [liga] = await tx`select * from ligas where data = ${data} for update`;
    if (liga) {
      if (liga.status !== 'aberta') throw new RuleError('Esse palpite não está aberto para entrada.');
      const [{ n }] = await tx`select count(*)::int as n from entradas where liga_id = ${liga.id}`;
      if (n > 0) throw new RuleError('Não dá pra trocar os jogos: já tem palpiteiros nessa múltipla.');
      if (input.premio_desc !== undefined) {
        await tx`update ligas set premio_desc = ${input.premio_desc ? String(input.premio_desc) : null} where id = ${liga.id}`;
      }
    } else {
      [liga] = await tx`
        insert into ligas (data, premio_desc, custo_entrada, fichas_por_entrada)
        values (${data}, ${input.premio_desc ? String(input.premio_desc) : null},
                ${config.custo_entrada_pontos}, ${config.fichas_por_entrada})
        returning *`;
    }

    await tx`delete from jogos where liga_id = ${liga.id} and not (fixture_id = any(${ids}::bigint[]))`;
    for (const [i, f] of pool.entries()) {
      await tx`
        insert into jogos (liga_id, fixture_id, time_casa, time_fora, horario, campeonato, ordem)
        values (${liga.id}, ${f.fixture_id}, ${f.time_casa}, ${f.time_fora}, ${f.horario}, ${f.campeonato}, ${i})
        on conflict (liga_id, fixture_id) do update set
          time_casa = excluded.time_casa, time_fora = excluded.time_fora, horario = excluded.horario,
          campeonato = excluded.campeonato`;
      // Jogo sem mercados ganha os sugeridos pelas odds importadas (o admin ainda pode editar).
      const sugeridos = (f.mercados_sugeridos ?? []) as { grupo?: string; descricao: string; multiplicador: number }[];
      if (sugeridos.length) {
        const [j] = await tx`
          select j.id from jogos j where j.liga_id = ${liga.id} and j.fixture_id = ${f.fixture_id}
            and not exists (select 1 from mercados m where m.jogo_id = j.id)`;
        if (j) {
          await tx`insert into mercados ${tx(
            sugeridos.map((m, ordem) => ({ jogo_id: j.id, grupo: m.grupo ?? '', descricao: m.descricao, multiplicador: m.multiplicador, ordem })),
            'jogo_id', 'grupo', 'descricao', 'multiplicador', 'ordem',
          )}`;
        }
      }
    }
    await tx`update fixtures_dia set selecionado = (fixture_id = any(${ids}::bigint[])) where data = ${data}`;
    return liga.id as string;
  });
  return ligaAdmin(sql, ligaId);
}

export async function ligaAdmin(db: Db, ligaId: string) {
  const liga = await getLiga(db, ligaId);
  const participantes = await db`
    select e.user_id, u.nome, u.bairro,
      coalesce((select sum(a.fichas_apostadas) from apostas a join mercados m on m.id = a.mercado_id
        join jogos j on j.id = m.jogo_id where j.liga_id = ${ligaId} and a.user_id = e.user_id), 0)::int
      + coalesce((select sum(mu.fichas_apostadas) from multiplas mu
        where mu.liga_id = ${ligaId} and mu.user_id = e.user_id), 0)::int as fichas_apostadas
    from entradas e join users u on u.id = e.user_id
    where e.liga_id = ${ligaId}
    order by e.created_at`;
  return {
    liga,
    palpiteiros: participantes.length,
    participantes: participantes.map((p) => ({
      user_id: p.user_id as string,
      nome: p.nome as string,
      bairro: p.bairro as string,
      fichas_apostadas: num(p.fichas_apostadas),
    })),
    jogos: await jogosComMercados(db, ligaId),
  };
}

/** Tira o usuário da múltipla: apaga as fichas apostadas e a entrada e devolve os PONTOS pagos. */
export async function removerPalpiteiro(sql: Db, ligaId: string, userId: string) {
  if (!isUuid(userId)) throw new NotFoundError('Palpiteiro não encontrado.');
  await sql.begin(async (tx: Tx) => {
    const liga = await getLiga(tx, ligaId, 'for update');
    if (liga.status === 'finalizada') throw new RuleError('Reative o palpite antes de remover palpiteiros.');
    const [e] = await tx`select pontos_pagos from entradas where liga_id = ${ligaId} and user_id = ${userId} for update`;
    if (!e) throw new NotFoundError('Palpiteiro não encontrado.');
    await tx`
      delete from apostas a using mercados m, jogos j
      where a.mercado_id = m.id and m.jogo_id = j.id and j.liga_id = ${ligaId} and a.user_id = ${userId}`;
    await tx`delete from multiplas where liga_id = ${ligaId} and user_id = ${userId}`;
    await tx`delete from entradas where liga_id = ${ligaId} and user_id = ${userId}`;
    await tx`update users set saldo_pontos = saldo_pontos + ${e.pontos_pagos} where id = ${userId}`;
  });
  return ligaAdmin(sql, ligaId);
}

export async function ligaAdminPorData(db: Db, data: string) {
  const liga = await getLigaPorData(db, validarDataISO(data));
  return liga ? ligaAdmin(db, liga.id) : { liga: null, palpiteiros: 0, participantes: [], jogos: [] };
}

export async function marcarDestaque(sql: Db, jogoId: string) {
  if (!isUuid(jogoId)) throw new NotFoundError('Jogo não encontrado.');
  const ligaId = await sql.begin(async (tx: Tx) => {
    const [j] = await tx`select liga_id from jogos where id = ${jogoId} for update`;
    if (!j) throw new NotFoundError('Jogo não encontrado.');
    await tx`update jogos set destaque = false where liga_id = ${j.liga_id} and destaque`;
    await tx`update jogos set destaque = true where id = ${jogoId}`;
    return j.liga_id as string;
  });
  return ligaAdmin(sql, ligaId);
}

/**
 * Define os mercados de um jogo (lista completa). Itens com `id` são atualizados, sem `id` são criados e os
 * omitidos são removidos. Mercados que já receberam fichas não podem ser alterados nem removidos.
 */
export async function definirMercados(sql: Db, jogoId: string, mercadosInput: unknown) {
  if (!isUuid(jogoId)) throw new NotFoundError('Jogo não encontrado.');
  if (!Array.isArray(mercadosInput)) throw new RuleError('Envie a lista de mercados.');
  const itens = mercadosInput.map((m, i) => {
    const multiplicador = Math.round(Number(m?.multiplicador) * 100) / 100;
    if (!(multiplicador >= 1.01 && multiplicador <= 1000)) throw new RuleError('Multiplicador inválido.');
    if (m?.id != null && !isUuid(m.id)) throw new RuleError('Mercado inválido para esse palpite.');
    const grupo = m?.grupo == null ? '' : String(m.grupo).trim().toUpperCase();
    if (grupo.length > 40) throw new RuleError('Nome do mercado muito longo.');
    return { id: (m?.id as string) ?? null, grupo, descricao: texto(m?.descricao, 'Descrição').toUpperCase(), multiplicador, ordem: i };
  });

  const ligaId = await sql.begin(async (tx: Tx) => {
    const [j] = await tx`
      select j.liga_id, l.status from jogos j join ligas l on l.id = j.liga_id where j.id = ${jogoId} for update of j`;
    if (!j) throw new NotFoundError('Jogo não encontrado.');
    if (j.status === 'finalizada') throw new RuleError('Palpite já finalizado.');

    const atuais = await tx`
      select m.*, (exists(select 1 from apostas a where a.mercado_id = m.id)
              or exists(select 1 from multipla_pernas p where p.mercado_id = m.id)) as tem_apostas
      from mercados m where m.jogo_id = ${jogoId}`;
    const porId = new Map(atuais.map((m) => [m.id as string, m]));
    for (const it of itens) if (it.id && !porId.has(it.id)) throw new RuleError('Mercado inválido para esse palpite.');

    const manter = new Set(itens.filter((i) => i.id).map((i) => i.id as string));
    for (const m of atuais) {
      if (!manter.has(m.id as string)) {
        if (m.tem_apostas) throw new RuleError(`O mercado "${m.descricao}" já recebeu fichas e não pode ser removido.`);
        await tx`delete from mercados where id = ${m.id}`;
      }
    }
    for (const it of itens) {
      const atual = it.id ? porId.get(it.id) : null;
      if (atual) {
        const mudou = atual.grupo !== it.grupo || atual.descricao !== it.descricao || num(atual.multiplicador) !== it.multiplicador;
        if (mudou && atual.tem_apostas) {
          throw new RuleError(`O mercado "${atual.descricao}" já recebeu fichas e não pode ser alterado.`);
        }
        await tx`
          update mercados set grupo = ${it.grupo}, descricao = ${it.descricao}, multiplicador = ${it.multiplicador}, ordem = ${it.ordem}
          where id = ${it.id}`;
      } else {
        await tx`
          insert into mercados (jogo_id, grupo, descricao, multiplicador, ordem)
          values (${jogoId}, ${it.grupo}, ${it.descricao}, ${it.multiplicador}, ${it.ordem})`;
      }
    }
    return j.liga_id as string;
  });
  return ligaAdmin(sql, ligaId);
}

/** Abre/fecha a múltipla para entradas e apostas ('aberta' ↔ 'em_andamento'). Finalizar é outro endpoint. */
export async function atualizarLiga(db: Db, ligaId: string, input: { status?: unknown; premio_desc?: unknown }) {
  const liga = await getLiga(db, ligaId);
  if (liga.status === 'finalizada') throw new RuleError('Palpite já finalizado.');
  const status = input.status == null ? liga.status : String(input.status);
  if (status !== 'aberta' && status !== 'em_andamento') throw new RuleError('Status inválido.');
  const premioDesc = input.premio_desc === undefined ? liga.premio_desc : input.premio_desc ? String(input.premio_desc) : null;
  await db`update ligas set status = ${status}, premio_desc = ${premioDesc} where id = ${ligaId}`;
  return ligaAdmin(db, ligaId);
}

/** Histórico das múltiplas (mais recentes primeiro), com jogos, palpiteiros e vencedor. */
export async function listarLigas(db: Db) {
  const rows = await db`
    select l.id, l.data::text as data, l.status, l.premio_desc, l.premio_final, l.finalizada_em,
      (select count(*)::int from entradas e where e.liga_id = l.id) as palpiteiros,
      coalesce((select json_agg(j.time_casa || ' x ' || j.time_fora order by j.horario)
        from jogos j where j.liga_id = l.id), '[]'::json) as jogos,
      (select u.nome from vouchers v join users u on u.id = v.user_id where v.liga_id = l.id limit 1) as vencedor
    from ligas l order by l.data desc limit 60`;
  return {
    ligas: rows.map((l) => ({
      id: l.id as string,
      data: l.data as string,
      status: l.status as string,
      premio_desc: (l.premio_desc as string) ?? null,
      premio_final: l.premio_final == null ? null : Number(l.premio_final),
      finalizada_em: l.finalizada_em ? new Date(l.finalizada_em as string).toISOString() : null,
      palpiteiros: l.palpiteiros as number,
      jogos: l.jogos as string[],
      vencedor: (l.vencedor as string) ?? null,
    })),
  };
}
