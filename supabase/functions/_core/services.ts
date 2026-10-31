import type { UserPublico } from './auth.ts';
import { type Db, iso, num } from './db.ts';
import { progressoPremio } from './premio.ts';
import {
  calcularRanking,
  contarPalpiteiros,
  fichasUsadas,
  getEntrada,
  getEscada,
  getLigaAtual,
  type LigaRow,
  pontuacaoUsuario,
} from './rules.ts';
import { hojeISO } from './validation.ts';

export type MercadoView = {
  id: string;
  grupo: string;
  descricao: string;
  multiplicador: number;
  resultado_final: boolean;
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
  mercados: MercadoView[];
};

export async function getConfig(db: Db) {
  const [c] = await db`select * from config where id = 1`;
  return {
    qtd_jogos_dia: num(c.qtd_jogos_dia),
    fichas_por_entrada: num(c.fichas_por_entrada),
    custo_entrada_pontos: num(c.custo_entrada_pontos),
    pontos_boas_vindas: num(c.pontos_boas_vindas),
    termos_versao: c.termos_versao as string,
    consentimento_versao: c.consentimento_versao as string,
  };
}

/** Mercados da múltipla agrupados por jogo (destaque primeiro). Com userId, inclui as fichas já apostadas. */
export async function jogosComMercados(db: Db, ligaId: string, userId?: string | null): Promise<JogoView[]> {
  const jogos = await db`
    select *, horario <= now() as comecou from jogos where liga_id = ${ligaId}
    order by destaque desc, horario, ordem, time_casa`;
  if (jogos.length === 0) return [];
  const mercados = await db`
    select m.*, coalesce((select sum(a.fichas_apostadas) from apostas a
                          where a.mercado_id = m.id and a.user_id = ${userId ?? null}::uuid), 0)::int as minhas
    from mercados m where m.jogo_id in ${db(jogos.map((j) => j.id as string))}
    order by m.ordem, m.descricao`;
  return jogos.map((j) => ({
    id: j.id as string,
    fixture_id: num(j.fixture_id),
    time_casa: j.time_casa as string,
    time_fora: j.time_fora as string,
    horario: iso(j.horario)!,
    campeonato: j.campeonato as string,
    destaque: !!j.destaque,
    comecou: !!j.comecou,
    mercados: mercados
      .filter((m) => m.jogo_id === j.id)
      .map((m) => ({
        id: m.id as string,
        grupo: (m.grupo as string) ?? '',
        descricao: m.descricao as string,
        multiplicador: num(m.multiplicador),
        resultado_final: !!m.resultado_final,
        ...(userId ? { minhas_fichas: num(m.minhas) } : {}),
      })),
  }));
}

async function premioDaLiga(db: Db, liga: LigaRow) {
  const [escada, palpiteiros] = await Promise.all([getEscada(db), contarPalpiteiros(db, liga.id)]);
  return progressoPremio(escada, palpiteiros, liga.status === 'finalizada' ? liga.premio_final : null);
}

async function minhaSituacao(db: Db, userId: string, liga: LigaRow) {
  const entrada = await getEntrada(db, userId, liga.id);
  if (!entrada) return { entrou: false as const };
  const [usadas, pontuacao, ranking] = await Promise.all([
    fichasUsadas(db, userId, liga.id),
    pontuacaoUsuario(db, userId, liga.id),
    calcularRanking(db, liga.id),
  ]);
  return {
    entrou: true as const,
    fichas_total: entrada.fichas_total,
    fichas_usadas: usadas,
    fichas_livres: Math.max(0, entrada.fichas_total - usadas),
    pontuacao,
    posicao: ranking.find((r) => r.user_id === userId)?.posicao ?? null,
  };
}

/** Tudo que a home precisa: múltipla do dia, jogos (com destaque), barra do prêmio e situação do usuário. */
export async function home(db: Db, user: UserPublico | null, data = hojeISO()) {
  const [liga, config] = await Promise.all([getLigaAtual(db, data), getConfig(db)]);
  const base = {
    data,
    regras: {
      custo_entrada_pontos: liga?.custo_entrada ?? config.custo_entrada_pontos,
      fichas_por_entrada: liga?.fichas_por_entrada ?? config.fichas_por_entrada,
    },
    usuario: user ? { id: user.id, nome: user.nome, saldo_pontos: user.saldo_pontos, is_admin: user.is_admin } : null,
  };
  if (!liga) return { ...base, liga: null, jogos: [], premio: progressoPremio(await getEscada(db), 0), eu: null };
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
  const historico = await db`
    select l.id, l.data, l.status, e.fichas_total, e.created_at
    from entradas e join ligas l on l.id = e.liga_id where e.user_id = ${user.id}
    order by l.data desc limit 30`;
  return {
    user,
    vouchers: vouchers.map((v) => ({
      codigo: v.codigo as string,
      valor: num(v.valor),
      resgatado: !!v.resgatado,
      data: iso(v.data)!.slice(0, 10),
    })),
    historico: historico.map((h) => ({
      liga_id: h.id as string,
      data: iso(h.data)!.slice(0, 10),
      status: h.status as string,
      fichas_total: num(h.fichas_total),
    })),
  };
}

/** Quem entrou na múltipla em vigor e como distribuiu as fichas, por ordem de entrada. */
export async function palpiteirosDoDia(db: Db, user: UserPublico | null, data = hojeISO()) {
  const liga = await getLigaAtual(db, data);
  if (!liga) return { data, liga: null, palpiteiros: [] };
  const [entradas, apostas] = await Promise.all([
    db`select e.user_id, u.nome, u.bairro, e.created_at from entradas e join users u on u.id = e.user_id
       where e.liga_id = ${liga.id} order by e.created_at`,
    db`select a.user_id, m.id as mercado_id, m.grupo, m.descricao, m.multiplicador, j.time_casa, j.time_fora,
         sum(a.fichas_apostadas)::int as fichas
       from apostas a join mercados m on m.id = a.mercado_id join jogos j on j.id = m.jogo_id
       where j.liga_id = ${liga.id}
       group by a.user_id, m.id, j.id
       order by j.destaque desc, j.horario, j.ordem, m.ordem`,
  ]);
  return {
    data,
    liga: { id: liga.id, status: liga.status },
    palpiteiros: entradas.map((e) => {
      const palpites = apostas
        .filter((a) => a.user_id === e.user_id)
        .map((a) => ({
          jogo: `${a.time_casa} x ${a.time_fora}`,
          grupo: (a.grupo as string) ?? '',
          descricao: a.descricao as string,
          multiplicador: num(a.multiplicador),
          fichas: num(a.fichas),
        }));
      return {
        nome: e.nome as string,
        bairro: e.bairro as string,
        entrou_em: iso(e.created_at)!,
        eu: user?.id === e.user_id,
        fichas_apostadas: palpites.reduce((s, p) => s + p.fichas, 0),
        palpites,
      };
    }),
  };
}
