import type { UserPublico } from './auth.ts';
import { exato, oddTotal } from './compat.ts';
import { type Db, iso, num } from './db.ts';
import { progressoPremio } from './premio.ts';
import {
  calcularRanking,
  contarPalpiteiros,
  fichasUsadas,
  livresDe,
  retornosPorUsuario,
  getEntrada,
  getEscada,
  getLiga,
  getLigaAtual,
  getPremioInicial,
  type LigaRow,
} from './rules.ts';
import { placarDoJogo } from './resultados.ts';
import { ForbiddenError } from './errors.ts';
import { hojeISO, nomePublico } from './validation.ts';

export type MercadoView = {
  id: string;
  grupo: string;
  descricao: string;
  multiplicador: number;
  resultado_final: boolean;
  decidido: boolean;
  minhas_fichas?: number;
};

export type JogoView = {
  id: string;
  fixture_id: number;
  time_casa: string;
  time_fora: string;
  horario: string;
  campeonato: string;
  destaque: boolean;
  comecou: boolean;
  finalizado: boolean;
  placar: { casa: number; fora: number } | null;
  mercados: MercadoView[];
};

export async function getConfig(db: Db) {
  const [c] = await db`select * from config where id = 1`;
  return {
    qtd_jogos_dia: num(c.qtd_jogos_dia),
    fichas_por_entrada: num(c.fichas_por_entrada),
    custo_entrada_pontos: num(c.custo_entrada_pontos),
    pontos_boas_vindas: num(c.pontos_boas_vindas),
    premio_inicial: num(c.premio_inicial),
    termos_versao: c.termos_versao as string,
    consentimento_versao: c.consentimento_versao as string,
  };
}

/** Mercados da múltipla agrupados por jogo (destaque primeiro). Com userId, inclui as fichas já apostadas. */
export async function jogosComMercados(db: Db, ligaId: string, userId?: string | null): Promise<JogoView[]> {
  const jogos = await db`
    select j.*, f.externo_id, j.horario <= now() as comecou
    from jogos j
    left join fixtures_dia f on f.fixture_id = j.fixture_id
    where j.liga_id = ${ligaId}
    order by j.destaque desc, j.horario, j.ordem, j.time_casa`;
  if (jogos.length === 0) return [];
  const mercados = await db`
    select m.*, coalesce((select sum(a.fichas_apostadas) from apostas a
                          where a.mercado_id = m.id and a.user_id = ${userId ?? null}::uuid), 0)::int as minhas
    from mercados m where m.jogo_id in ${db(jogos.map((j) => j.id as string))} and m.oculto = false
    order by m.ordem, m.descricao`;
  return jogos.map((j) => ({
    id: j.id as string,
    fixture_id: num(j.fixture_id),
    externo_id: (j.externo_id as string) ?? null,
    time_casa: j.time_casa as string,
    time_fora: j.time_fora as string,
    horario: iso(j.horario)!,
    campeonato: j.campeonato as string,
    destaque: !!j.destaque,
    comecou: !!j.comecou,
    finalizado: j.finalizado_em != null,
    placar: placarDoJogo(j),
    mercados: mercados
      .filter((m) => m.jogo_id === j.id)
      .map((m) => ({
        id: m.id as string,
        grupo: (m.grupo as string) ?? '',
        descricao: m.descricao as string,
        multiplicador: num(m.multiplicador),
        resultado_final: !!m.resultado_final,
        decidido: m.decidido_em != null,
        ...(userId ? { minhas_fichas: num(m.minhas) } : {}),
      })),
  }));
}

async function premioDaLiga(db: Db, liga: LigaRow) {
  const [escada, palpiteiros, inicial] = await Promise.all([
    getEscada(db),
    contarPalpiteiros(db, liga.id),
    getPremioInicial(db),
  ]);
  return progressoPremio(escada, palpiteiros, liga.status === 'finalizada' ? liga.premio_final : null, inicial);
}

export type MultiplaView = {
  id: string;
  fichas: number;
  odd: number;
  pernas: {
    mercado_id: string;
    jogo: string;
    grupo: string;
    descricao: string;
    odd: number;
    resultado_final: boolean;
    comecou: boolean;
    finalizado: boolean;
  }[];
};

/** Múltiplas confirmadas (por usuário), na ordem em que foram criadas. */
async function multiplasDaLiga(db: Db, ligaId: string, userId?: string) {
  const rows = await db`
    select mu.id, mu.user_id, mu.fichas_apostadas, p.mercado_id, p.odd, m.grupo, m.descricao, m.resultado_final,
           j.time_casa, j.time_fora, j.horario <= now() as comecou,
           (j.finalizado_em is not null or m.decidido_em is not null) as finalizado
    from multiplas mu join multipla_pernas p on p.multipla_id = mu.id
    join mercados m on m.id = p.mercado_id join jogos j on j.id = m.jogo_id
    where mu.liga_id = ${ligaId} and (${userId ?? null}::uuid is null or mu.user_id = ${userId ?? null}::uuid)
    order by mu.created_at, mu.id, j.horario, j.ordem, m.ordem`;
  const out = new Map<string, MultiplaView & { user_id: string }>();
  for (const r of rows) {
    const m = out.get(r.id as string) ?? {
      id: r.id as string,
      user_id: r.user_id as string,
      fichas: num(r.fichas_apostadas),
      odd: 1,
      pernas: [],
    };
    m.pernas.push({
      mercado_id: r.mercado_id as string,
      jogo: `${r.time_casa} x ${r.time_fora}`,
      grupo: (r.grupo as string) ?? '',
      descricao: r.descricao as string,
      odd: num(r.odd),
      resultado_final: !!r.resultado_final,
      comecou: !!r.comecou,
      finalizado: !!r.finalizado,
    });
    out.set(r.id as string, m);
  }
  for (const m of out.values()) m.odd = oddTotal(m.pernas.map((p) => p.odd));
  return [...out.values()];
}

async function multiplasDoUsuario(db: Db, userId: string, ligaId: string): Promise<MultiplaView[]> {
  return (await multiplasDaLiga(db, ligaId, userId)).map(({ user_id: _, ...m }) => m);
}

export async function minhaSituacao(db: Db, userId: string, liga: LigaRow) {
  const entrada = await getEntrada(db, userId, liga.id);
  if (!entrada) return { entrou: false as const };
  const [usadas, ranking, multiplas, retornos] = await Promise.all([
    fichasUsadas(db, userId, liga.id),
    calcularRanking(db, liga.id),
    multiplasDoUsuario(db, userId, liga.id),
    retornosPorUsuario(db, liga.id),
  ]);
  const ganhas = retornos.get(userId) ?? 0;
  const eu = ranking.find((r) => r.user_id === userId);
  return {
    entrou: true as const,
    multiplas,
    fichas_total: entrada.fichas_total,
    fichas_usadas: usadas,
    fichas_ganhas: ganhas,
    fichas_livres: livresDe(entrada.fichas_total, ganhas, usadas),
    pontuacao: eu?.pontuacao ?? 0,
    posicao: eu?.posicao ?? null,
  };
}

/** Tudo que a home precisa: múltipla do dia, jogos (com destaque), barra do prêmio e situação do usuário. */
const CURVA_LOGIN = [40, 50, 60, 70, 80, 90, 110];

/** Resgata o bônus de login do dia (sequência de 7, zera se faltar). Só no primeiro acesso do dia. */
async function claimLoginBonus(db: Db, userId: string, hoje: string) {
  const [u] = await db`
    select login_streak, ultimo_login = ${hoje}::date as ja, ultimo_login = ${hoje}::date - 1 as ontem
    from users where id = ${userId} for update`;
  if (!u || u.ja) return null;
  const anterior = num(u.login_streak);
  const quebrou = !u.ontem && anterior > 0;
  // Ontem = continua a rampa; depois do 7º dia recomeça; sem streak/ontem = dia 1.
  const dia = u.ontem ? (anterior >= 7 ? 1 : anterior + 1) : 1;
  const pontos = CURVA_LOGIN[dia - 1];
  await db`
    update users set saldo_pontos = saldo_pontos + ${pontos}, login_streak = ${dia}, ultimo_login = ${hoje}::date,
      maior_streak = greatest(maior_streak, ${dia})
    where id = ${userId}`;
  return { dia, pontos, quebrou };
}

export async function home(db: Db, user: UserPublico | null, data = hojeISO()) {
  const [liga, config] = await Promise.all([getLigaAtual(db, data), getConfig(db)]);
  const bonus = user ? await claimLoginBonus(db, user.id, data) : null;
  const base = {
    data,
    regras: {
      custo_entrada_pontos: liga?.custo_entrada ?? config.custo_entrada_pontos,
      fichas_por_entrada: liga?.fichas_por_entrada ?? config.fichas_por_entrada,
    },
    usuario: user
      ? {
          id: user.id,
          nome: user.nome,
          saldo_pontos: num(user.saldo_pontos) + (bonus?.pontos ?? 0),
          is_admin: user.is_admin,
          login_streak: bonus?.dia ?? num(user.login_streak),
          maior_streak: Math.max(num(user.maior_streak), bonus?.dia ?? 0),
        }
      : null,
    bonus_login: bonus,
  };
  if (!liga) return { ...base, liga: null, jogos: [], premio: progressoPremio(await getEscada(db), 0, null, config.premio_inicial), eu: null };
  const [jogos, premio, eu] = await Promise.all([
    jogosComMercados(db, liga.id, user?.id),
    premioDaLiga(db, liga),
    user ? minhaSituacao(db, user.id, liga) : Promise.resolve(null),
  ]);
  return { ...base, liga, jogos, premio, eu };
}

export async function rankingDoDia(db: Db, user: UserPublico | null, data = hojeISO()) {
  const liga = await getLigaAtual(db, data);
  if (!liga) return { data, liga: null, ranking: [] };
  const ranking = await calcularRanking(db, liga.id);
  return {
    data,
    liga: { id: liga.id, status: liga.status },
    ranking: ranking.map(({ user_id, ...r }) => ({ ...r, eu: user?.id === user_id })),
  };
}

export async function perfil(db: Db, user: UserPublico) {
  const vouchers = await db`
    select v.codigo, v.valor, v.resgatado, v.created_at, l.data
    from vouchers v join ligas l on l.id = v.liga_id where v.user_id = ${user.id} order by v.created_at desc`;
  const [historico, [total], [simples], [mults]] = await Promise.all([
    participacoes(db, user),
    db`select count(*)::int as n from entradas where user_id = ${user.id}`,
    // Palpites já decididos (mercado apurado ou rodada encerrada). Múltipla inteira conta 1.
    db`
      select count(distinct a.mercado_id) filter (where m.resultado_final)::int as certos,
             count(distinct a.mercado_id)::int as total
      from apostas a join mercados m on m.id = a.mercado_id
      join jogos j on j.id = m.jogo_id join ligas l on l.id = j.liga_id
      where a.user_id = ${user.id} and (m.decidido_em is not null or l.status = 'finalizada')`,
    db`
      select count(*) filter (where perdidas = 0)::int as certos, count(*)::int as total from (
        select mu.id,
               count(*) filter (where not coalesce(m.resultado_final, false)
                                  and (m.decidido_em is not null or l.status = 'finalizada')) as perdidas,
               count(*) filter (where m.decidido_em is null and l.status <> 'finalizada') as pendentes
        from multiplas mu join multipla_pernas p on p.multipla_id = mu.id
        join mercados m on m.id = p.mercado_id join ligas l on l.id = mu.liga_id
        where mu.user_id = ${user.id}
        group by mu.id
      ) x where perdidas > 0 or pendentes = 0`,
  ]);
  const fechadas = historico.filter((h) => h.status === 'finalizada');
  const duelos = fechadas.filter((h) => h.modo === 'duelo' && h.palpiteiros === 2);
  const decididos = num(simples.total) + num(mults.total);
  return {
    user,
    vouchers: vouchers.map((v) => ({
      codigo: v.codigo as string,
      valor: num(v.valor),
      resgatado: !!v.resgatado,
      data: iso(v.data)!.slice(0, 10),
    })),
    historico,
    // Vitórias/pódios/recordes saem das participações carregadas (as 50 mais recentes).
    stats: {
      participacoes: num(total.n),
      vitorias: fechadas.filter((h) => h.posicao === 1 && h.pontuacao > 0).length,
      podios: fechadas.filter((h) => h.posicao != null && h.posicao <= 3 && h.pontuacao > 0).length,
      maior_odd: Math.max(0, ...historico.map((h) => h.maior_acerto)),
      // Só rodadas do dia: desafio tem fichas por entrada próprias e distorceria o recorde.
      recorde_pontos: Math.max(0, ...historico.filter((h) => !h.desafio).map((h) => h.pontuacao)),
      palpites_decididos: decididos,
      taxa_acerto: decididos ? Math.round(((num(simples.certos) + num(mults.certos)) / decididos) * 100) : null,
      duelos_vitorias: duelos.filter((h) => h.posicao === 1 && h.pontuacao > 0).length,
      duelos_derrotas: duelos.filter((h) => h.posicao === 2 && h.pontuacao_lider > 0).length,
    },
  };
}

const resultadoDe = (finalizado: boolean, certo: boolean) => (finalizado ? (certo ? 'green' : 'red') : null);

/**
 * Quem entrou na rodada em vigor. Dos outros, só aparecem os palpites dos jogos que já começaram (mercado
 * e odd, sem fichas nem retorno); com a rodada finalizada, tudo. O próprio usuário vê o bilhete inteiro.
 */
export async function palpiteirosDoDia(db: Db, user: UserPublico | null, data = hojeISO()) {
  const liga = await getLigaAtual(db, data);
  if (!liga) return { data, liga: null, palpiteiros: [] };
  return palpiteirosDaLiga(db, user, liga);
}

/** Mesma visão de palpiteiros/bilhetes do dia, para uma liga qualquer (desafios). */
export async function palpiteirosDaLiga(db: Db, user: UserPublico | null, liga: LigaRow, verTudo = false) {
  const data = liga.data;
  const [entradas, apostas, multiplas] = await Promise.all([
    db`select e.user_id, u.nome, e.created_at, e.fichas_total from entradas e join users u on u.id = e.user_id
       where e.liga_id = ${liga.id} order by e.created_at`,
    db`select a.user_id, m.id as mercado_id, m.grupo, m.descricao, m.resultado_final, max(a.odd) as multiplicador,
         j.time_casa, j.time_fora, j.horario <= now() as comecou,
         (j.finalizado_em is not null or m.decidido_em is not null) as finalizado,
         sum(a.fichas_apostadas)::int as fichas
       from apostas a join mercados m on m.id = a.mercado_id join jogos j on j.id = m.jogo_id
       where j.liga_id = ${liga.id}
       group by a.user_id, m.id, j.id
       order by j.destaque desc, j.horario, j.ordem, m.ordem`,
    multiplasDaLiga(db, liga.id),
  ]);
  const ranking = await calcularRanking(db, liga.id);
  const tudo = liga.status === 'finalizada';
  return {
    data,
    liga: { id: liga.id, status: liga.status },
    palpiteiros: entradas.map((e) => {
      const eu = user?.id === e.user_id;
      // Jogo que não começou continua oculto mesmo se a rodada for finalizada antes.
      const ver = (comecou: boolean) => eu || comecou || verTudo;
      // Desafio é entre amigos: fichas de todos são públicas pra conferência.
      const mostraFichas = eu || verTudo || liga.owner_id != null;
      const palpites = apostas
        .filter((a) => a.user_id === e.user_id && ver(!!a.comecou))
        .map((a) => ({
          jogo: `${a.time_casa} x ${a.time_fora}`,
          grupo: (a.grupo as string) ?? '',
          descricao: a.descricao as string,
          multiplicador: num(a.multiplicador),
          resultado: resultadoDe(!!a.finalizado || tudo, !!a.resultado_final),
          ...(mostraFichas ? { fichas: num(a.fichas) } : {}),
        }));
      // Detalhe por seção (Simples / cada Múltipla) só no próprio bilhete ou no admin:
      // do adversário mostra só o potencial total, sem quebrar por seção.
      const potencialSimples = eu || verTudo
        ? exato(
            apostas
              .filter((a) => a.user_id === e.user_id && !a.finalizado)
              .reduce((t, a) => t + num(a.fichas) * num(a.multiplicador), 0),
          )
        : null;
      // Potencial de cada múltipla: fichas × odd total se nenhuma perna morreu e ainda tem perna viva.
      // Perna oculta mascara o potencial pra não vazar a odd escondida.
      const potMult = (m: (typeof multiplas)[number], ocultas: number) => {
        if (!(eu || verTudo) || ocultas > 0) return null;
        const morta = m.pernas.some((p) => p.finalizado && !p.resultado_final);
        const viva = m.pernas.some((p) => !p.finalizado);
        return !morta && viva ? exato(m.fichas * m.odd) : 0;
      };
      const minhas = multiplas
        .filter((m) => m.user_id === e.user_id)
        .map((m, k) => {
          const pernas = m.pernas.filter((p) => ver(p.comecou));
          return {
            numero: k + 1,
            ocultas: m.pernas.length - pernas.length,
            potencial: potMult(m, m.pernas.length - pernas.length),
            // Com perna oculta, o total permitiria deduzir a odd escondida.
            odd: pernas.length === m.pernas.length ? m.odd : null,
            pernas: pernas.map((p) => ({
              jogo: p.jogo,
              grupo: p.grupo,
              descricao: p.descricao,
              odd: p.odd,
              resultado: resultadoDe(p.finalizado || tudo, p.resultado_final),
            })),
            ...(mostraFichas ? { fichas: m.fichas } : {}),
          };
        })
        .filter((m) => m.pernas.length > 0);
      const r = ranking.find((x) => x.user_id === e.user_id);
      // Potencial total: público (já aparece no ranking de todo mundo), sem detalhar composição.
      const potencial = exato(
            apostas
              .filter((a) => a.user_id === e.user_id && !(a.finalizado && !a.resultado_final))
              .reduce((t, a) => t + num(a.fichas) * num(a.multiplicador), 0) +
              multiplas
                .filter((m) => m.user_id === e.user_id && !m.pernas.some((p) => p.finalizado && !p.resultado_final))
                .reduce((t, m) => t + m.fichas * m.odd, 0) -
              // As fichas iniciais não contam: só o que passar delas sai do que já foi ganho.
              Math.max(
                0,
                apostas.filter((a) => a.user_id === e.user_id).reduce((t, a) => t + num(a.fichas), 0) +
                  multiplas.filter((m) => m.user_id === e.user_id).reduce((t, m) => t + m.fichas, 0) -
                  num(e.fichas_total),
              ),
          );
      return {
        nome: e.nome as string,
        entrou_em: iso(e.created_at)!,
        eu,
        posicao: r?.posicao ?? null,
        desempate: r?.desempate ?? null,
        maior_acerto: r?.maior_acerto ?? 0,
        acertos: r?.acertos ?? 0,
        pontuacao: r?.pontuacao ?? 0,
        potencial,
        potencial_simples: potencialSimples,
        palpites,
        multiplas: minhas,
      };
    })
    .sort((a, b) => (a.posicao ?? 1e9) - (b.posicao ?? 1e9)),
  };
}


/** Rodadas/desafios em que o usuário entrou, com sua posição e pontuação final/atual. */
export async function historico(db: Db, user: UserPublico) {
  return { historico: await participacoes(db, user) };
}

async function participacoes(db: Db, user: UserPublico) {
  const rows = await db`
    select e.liga_id, e.fichas_total, e.pontos_pagos, e.created_at as entrou_em,
           l.data, l.status, l.titulo, l.owner_id, l.premio_final, l.modo,
           u.nome as dono_nome
    from entradas e
    join ligas l on l.id = e.liga_id
    left join users u on u.id = l.owner_id
    where e.user_id = ${user.id}
    order by l.data desc, e.created_at desc limit 50`;
  const out = [];
  for (const r of rows) {
    const ranking = await calcularRanking(db, r.liga_id as string);
    const eu = ranking.find((x) => x.user_id === user.id);
    out.push({
      liga_id: r.liga_id as string,
      data: r.data instanceof Date ? r.data.toISOString().slice(0, 10) : String(r.data),
      status: r.status as LigaRow['status'],
      desafio: r.owner_id != null,
      titulo: (r.titulo as string) ?? null,
      dono: r.dono_nome ? nomePublico(r.dono_nome as string) : null,
      fichas_total: num(r.fichas_total),
      pontos_pagos: num(r.pontos_pagos),
      pontuacao: eu?.pontuacao ?? 0,
      posicao: eu?.posicao ?? null,
      palpiteiros: ranking.length,
      premio_final: r.premio_final == null ? null : num(r.premio_final),
      entrou_em: iso(r.entrou_em)!,
      modo: ((r.modo as string) ?? 'grupo') as 'grupo' | 'duelo',
      // Duelo: o nome do outro lado, pra linha do histórico dizer contra quem foi.
      adversario:
        r.modo === 'duelo' && ranking.length === 2 ? (ranking.find((x) => x.user_id !== user.id)?.nome ?? null) : null,
      maior_acerto: eu?.maior_acerto ?? 0,
      pontuacao_lider: ranking[0]?.pontuacao ?? 0,
    });
  }
  return out;
}

/** O bilhete completo do usuário numa rodada/desafio de que ele participou. */
export async function meuBilhete(db: Db, user: UserPublico, ligaId: string) {
  const [e] = await db`select 1 from entradas where liga_id = ${ligaId} and user_id = ${user.id}`;
  if (!e) throw new ForbiddenError('Você não participou dessa rodada.');
  const liga = await getLiga(db, ligaId);
  const dono = liga.owner_id ? await db`select nome from users where id = ${liga.owner_id}` : [];
  const view = await palpiteirosDaLiga(db, user, liga);
  return {
    liga: {
      id: liga.id,
      data: liga.data,
      status: liga.status,
      desafio: liga.owner_id != null,
      titulo: liga.titulo,
      dono: dono.length ? nomePublico(dono[0].nome as string) : null,
      premio_final: liga.premio_final,
    },
    // Rank inteiro da rodada — a visão de palpiteiros já mascara fichas de jogos não iniciados.
    palpiteiros: view.palpiteiros,
    minha: view.palpiteiros.find((p) => p.eu) ?? null,
  };
}