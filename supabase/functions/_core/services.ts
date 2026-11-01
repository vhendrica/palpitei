import type { UserPublico } from './auth.ts';
import { oddTotal } from './compat.ts';
import { type Db, iso, num } from './db.ts';
import { progressoPremio } from './premio.ts';
import {
  calcularRanking,
  contarPalpiteiros,
  fichasUsadas,
  getEntrada,
  getEscada,
  getLigaAtual,
  getPremioInicial,
  type LigaRow,
  pontuacaoUsuario,
} from './rules.ts';
import { placarDoJogo } from './resultados.ts';
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
           j.time_casa, j.time_fora, j.horario <= now() as comecou, j.finalizado_em is not null as finalizado
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
    multiplas: await multiplasDoUsuario(db, userId, liga.id),
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

const resultadoDe = (finalizado: boolean, certo: boolean) => (finalizado ? (certo ? 'green' : 'red') : null);

/**
 * Quem entrou na rodada em vigor. Dos outros, só aparecem os palpites dos jogos que já começaram (mercado
 * e odd, sem fichas nem retorno); com a rodada finalizada, tudo. O próprio usuário vê o bilhete inteiro.
 */
export async function palpiteirosDoDia(db: Db, user: UserPublico | null, data = hojeISO()) {
  const liga = await getLigaAtual(db, data);
  if (!liga) return { data, liga: null, palpiteiros: [] };
  const [entradas, apostas, multiplas] = await Promise.all([
    db`select e.user_id, u.nome, e.created_at from entradas e join users u on u.id = e.user_id
       where e.liga_id = ${liga.id} order by e.created_at`,
    db`select a.user_id, m.id as mercado_id, m.grupo, m.descricao, m.resultado_final, max(a.odd) as multiplicador,
         j.time_casa, j.time_fora, j.horario <= now() as comecou, j.finalizado_em is not null as finalizado,
         sum(a.fichas_apostadas)::int as fichas
       from apostas a join mercados m on m.id = a.mercado_id join jogos j on j.id = m.jogo_id
       where j.liga_id = ${liga.id}
       group by a.user_id, m.id, j.id
       order by j.destaque desc, j.horario, j.ordem, m.ordem`,
    multiplasDaLiga(db, liga.id),
  ]);
  const tudo = liga.status === 'finalizada';
  return {
    data,
    liga: { id: liga.id, status: liga.status },
    palpiteiros: entradas.map((e) => {
      const eu = user?.id === e.user_id;
      const ver = (comecou: boolean) => eu || tudo || comecou;
      const palpites = apostas
        .filter((a) => a.user_id === e.user_id && ver(!!a.comecou))
        .map((a) => ({
          jogo: `${a.time_casa} x ${a.time_fora}`,
          grupo: (a.grupo as string) ?? '',
          descricao: a.descricao as string,
          multiplicador: num(a.multiplicador),
          resultado: resultadoDe(!!a.finalizado || tudo, !!a.resultado_final),
          ...(eu ? { fichas: num(a.fichas) } : {}),
        }));
      const minhas = multiplas
        .filter((m) => m.user_id === e.user_id)
        .map((m, k) => {
          const pernas = m.pernas.filter((p) => ver(p.comecou));
          return {
            numero: k + 1,
            odd: m.odd,
            ocultas: m.pernas.length - pernas.length,
            pernas: pernas.map((p) => ({
              jogo: p.jogo,
              grupo: p.grupo,
              descricao: p.descricao,
              odd: p.odd,
              resultado: resultadoDe(p.finalizado || tudo, p.resultado_final),
            })),
            ...(eu ? { fichas: m.fichas } : {}),
          };
        })
        .filter((m) => m.pernas.length > 0);
      return {
        nome: e.nome as string,
        entrou_em: iso(e.created_at)!,
        eu,
        palpites,
        multiplas: minhas,
      };
    }),
  };
}
