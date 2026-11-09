import * as admin from './admin.ts';
import * as auth from './auth.ts';
import * as desafios from './desafios.ts';
import type { Db } from './db.ts';
import { ForbiddenError, NotFoundError, RuleError } from './errors.ts';
import { importarOdds, mercadosDaApi, mercadosDaFixture, type OddsConfig } from './odds.ts';
import { aplicarPlacar, atualizarResultados } from './resultados.ts';
import { apostar, type MultiplaInput, entrarNaLiga, finalizarLiga, getLiga, getLigaAtual, reativarLiga } from './rules.ts';
import { home, historico, jogosComMercados, meuBilhete, palpiteirosDaLiga, palpiteirosDoDia, perfil, rankingDoDia } from './services.ts';
import { hojeISO } from './validation.ts';
import type { WhatsappSender } from './whatsapp.ts';

export type ApiDeps = {
  sql: Db;
  send: WhatsappSender;
  otp?: Partial<auth.OtpOptions>;
  /** Data "de hoje" (YYYY-MM-DD). Injetável para testes. */
  hoje?: () => string;
  corsOrigin?: string;
  odds?: OddsConfig;
  /** Segredo do agendador (pg_cron) para POST /cron/resultados. */
  cronSecret?: string;
};

/** Cron autorizado: segredo do env OU o gravado em cron_config (gerado pela migration do pg_cron). */
async function cronOk(sql: Db, segredo: string | null, envSecret?: string): Promise<boolean> {
  if (!segredo) return false;
  if (envSecret && segredo === envSecret) return true;
  try {
    const [r] = await sql`select valor from cron_config where chave = 'cron_secret'`;
    return !!r && r.valor === segredo;
  } catch {
    return false;
  }
}

type Ctx = {
  req: Request;
  params: string[];
  query: URLSearchParams;
  body: () => Promise<Record<string, unknown>>;
  token: string | null;
  user: () => Promise<auth.UserPublico | null>;
  requireUser: () => Promise<auth.UserPublico>;
  requireAdmin: () => Promise<auth.UserPublico>;
};

type Route = [method: string, pattern: RegExp, handler: (c: Ctx) => Promise<unknown>];

export function createApi(deps: ApiDeps) {
  const { sql } = deps;
  const authDeps: auth.AuthDeps = { sql, send: deps.send, otp: deps.otp, hoje: deps.hoje };
  const hoje = () => (deps.hoje ?? hojeISO)();

  const ligaDeHoje = async () => {
    const liga = await getLigaAtual(sql, hoje());
    if (!liga) throw new NotFoundError('Ainda não tem múltipla aberta. Volte mais tarde!');
    return liga;
  };

  // Lazy: preenche mercados_sugeridos pela Football API (1 req/fixture, cacheado). Cap pra não estourar o FREE.
  const atualizarSugeridosLazy = async (fixtures: Awaited<ReturnType<typeof admin.listarFixtures>>) => {
    let buscados = 0;
    for (const f of fixtures) {
      if (buscados >= 8) break;
      // fixture_id numérico = id da Football API; fontes antigas/manuais já devolvem [].
      const sugeridos = (f.mercados_sugeridos ?? []) as { grupo?: string }[];
      const legado = sugeridos.some((m) => /^(ESCANTEIOS|CARTÕES|ESCANTEIOS 1º TEMPO)$/.test(m.grupo ?? ''));
      if ((!sugeridos.length || legado) && f.fonte === 'api_football') {
        try {
          f.mercados_sugeridos = (await mercadosDaFixture(sql, deps.odds, String(f.fixture_id))) as never;
          buscados++;
        } catch {
          /* sem odds pra esse jogo */
        }
      }
    }
  };

  const routes: Route[] = [
    // ---- público / usuário
    ['GET', /^\/health$/, async () => ({ ok: true })],
    ['POST', /^\/auth\/cadastro$/, async (c) => auth.cadastrar(authDeps, (await c.body()) as auth.CadastroInput)],
    ['POST', /^\/auth\/login$/, async (c) => auth.solicitarCodigo(authDeps, { whatsapp: (await c.body()).whatsapp })],
    ['POST', /^\/auth\/reenviar$/, async (c) => auth.solicitarCodigo(authDeps, { whatsapp: (await c.body()).whatsapp })],
    ['POST', /^\/auth\/confirmar$/, async (c) => {
      const b = await c.body();
      return auth.confirmarCodigo(authDeps, { whatsapp: b.whatsapp, codigo: b.codigo });
    }],
    ['POST', /^\/auth\/logout$/, async (c) => {
      if (c.token) await auth.sair(sql, c.token);
      return { ok: true };
    }],
    ['GET', /^\/home$/, async (c) => home(sql, await c.user(), hoje())],
    ['GET', /^\/liga\/hoje\/mercados$/, async (c) => {
      const liga = await ligaDeHoje();
      return { liga, jogos: await jogosComMercados(sql, liga.id, (await c.user())?.id) };
    }],
    ['GET', /^\/liga\/hoje\/ranking$/, async (c) => rankingDoDia(sql, await c.user(), hoje())],
    ['GET', /^\/liga\/hoje\/palpiteiros$/, async (c) => palpiteirosDoDia(sql, await c.user(), hoje())],
    ['POST', /^\/liga\/hoje\/entrar$/, async (c) => {
      const u = await c.requireUser();
      return entrarNaLiga(sql, u.id, (await ligaDeHoje()).id);
    }],
    ['PUT', /^\/liga\/hoje\/apostas$/, async (c) => {
      const u = await c.requireUser();
      const b = await c.body();
      const bilhete = { simples: (b.simples ?? {}) as Record<string, number>, multiplas: (b.multiplas ?? []) as MultiplaInput[] };
      return apostar(sql, u.id, (await ligaDeHoje()).id, bilhete, { editar: true });
    }],
    ['POST', /^\/liga\/hoje\/apostas$/, async (c) => {
      const u = await c.requireUser();
      const b = await c.body();
      const bilhete =
        b.simples !== undefined || b.multiplas !== undefined
          ? { simples: b.simples as Record<string, number>, multiplas: b.multiplas as MultiplaInput[] }
          : ((b.distribuicao ?? {}) as Record<string, number>);
      return apostar(sql, u.id, (await ligaDeHoje()).id, bilhete);
    }],
    // ---- desafios (rodadas criadas por usuários; entrada grátis)
    ['GET', /^\/desafios$/, async (c) => desafios.meusDesafios(sql, (await c.requireUser()).id)],
    ['GET', /^\/desafios\/fixtures$/, async (c) => {
      await c.requireUser();
      const fixtures = await admin.listarFixtures(sql, c.query.get('data') ?? hoje());
      // Lazy: preenche mercados_sugeridos pela API (1 req/fixture, cacheado). Limite pra não estourar o FREE.
      let buscados = 0;
      for (const f of fixtures) {
        if (buscados >= 8) break;
        // fixture_id numérico = id da Football API; para fontes antigas/manuais a query interna já devolve [].
        const sugeridos = (f.mercados_sugeridos ?? []) as { grupo?: string }[];
        // Refaz quando vazio OU quando o cache está no formato antigo (grupo sem linha, ex.: "ESCANTEIOS").
        const legado = sugeridos.some((m) => /^(ESCANTEIOS|CARTÕES|ESCANTEIOS 1º TEMPO)$/.test(m.grupo ?? ''));
        if ((!sugeridos.length || legado) && f.fonte === 'api_football') {
          try {
            f.mercados_sugeridos = (await mercadosDaFixture(sql, deps.odds, String(f.fixture_id))) as never;
            buscados++;
          } catch {
            /* sem odds pra esse jogo */
          }
        }
      }
      return { fixtures };
    }],
    ['POST', /^\/desafios$/, async (c) => desafios.criarDesafio(sql, await c.requireUser(), await c.body())],
    ['GET', /^\/desafios\/convite\/([^/]+)$/, async (c) => desafios.conviteView(sql, c.params[0])],
    ['GET', /^\/desafios\/([^/]+)$/, async (c) => desafios.detalhe(sql, await c.user(), c.params[0], deps.odds)],
    ['POST', /^\/desafios\/([^/]+)\/entrar$/, async (c) => {
      const u = await c.requireUser();
      return entrarNaLiga(sql, u.id, (await desafios.porId(sql, c.params[0])).id);
    }],
    ['PUT', /^\/desafios\/([^/]+)\/apostas$/, async (c) => {
      const u = await c.requireUser();
      const b = await c.body();
      const bilhete = { simples: (b.simples ?? {}) as Record<string, number>, multiplas: (b.multiplas ?? []) as MultiplaInput[] };
      return apostar(sql, u.id, (await desafios.porId(sql, c.params[0])).id, bilhete, { editar: true });
    }],
    ['POST', /^\/desafios\/([^/]+)\/apostas$/, async (c) => {
      const u = await c.requireUser();
      const b = await c.body();
      const bilhete =
        b.simples !== undefined || b.multiplas !== undefined
          ? { simples: b.simples as Record<string, number>, multiplas: b.multiplas as MultiplaInput[] }
          : ((b.distribuicao ?? {}) as Record<string, number>);
      return apostar(sql, u.id, (await desafios.porId(sql, c.params[0])).id, bilhete);
    }],
    ['GET', /^\/desafios\/([^/]+)\/palpiteiros$/, async (c) => desafios.palpiteiros(sql, await c.user(), c.params[0])],
    ['POST', /^\/desafios\/([^/]+)\/finalizar$/, async (c) => desafios.finalizar(sql, await c.requireUser(), c.params[0])],
    ['POST', /^\/desafios\/([^/]+)\/jogos\/([^/]+)\/placar$/, async (c) => {
      const b = await c.body();
      return desafios.placarDono(sql, await c.requireUser(), c.params[0], c.params[1], Number(b.casa), Number(b.fora));
    }],

    ['POST', /^\/cron\/resultados$/, async (c) => {
      const segredo = c.req.headers.get('x-cron-secret');
      if (!(await cronOk(sql, segredo, deps.cronSecret))) await c.requireAdmin();
      return atualizarResultados(sql, deps.odds);
    }],
    ['POST', /^\/admin\/jogos\/([^/]+)\/placar$/, async (c) => {
      await c.requireAdmin();
      const b = await c.body();
      return aplicarPlacar(sql, c.params[0], Number(b.casa), Number(b.fora));
    }],
    ['GET', /^\/me$/, async (c) => perfil(sql, await c.requireUser())],

    // ---- histórico de palpites (o usuário só vê as rodadas que entrou)
    ['GET', /^\/historico$/, async (c) => historico(sql, await c.requireUser())],
    ['GET', /^\/historico\/([^/]+)$/, async (c) => meuBilhete(sql, await c.requireUser(), c.params[0])],

    // ---- admin (is_admin)
    ['GET', /^\/admin\/liga\/([^/]+)\/palpiteiros$/, async (c) => {
      const u = await c.requireAdmin();
      return palpiteirosDaLiga(sql, u, await getLiga(sql, c.params[0]), true);
    }],
    ['GET', /^\/admin\/config$/, async (c) => (await c.requireAdmin(), admin.configAdmin(sql))],
    ['PUT', /^\/admin\/config$/, async (c) => (await c.requireAdmin(), admin.atualizarConfig(sql, await c.body()))],
    ['PUT', /^\/admin\/premio-escada$/, async (c) => {
      await c.requireAdmin();
      const b = await c.body();
      return { premio_escada: await admin.salvarPremioEscada(sql, b.faixas, b.premio_inicial) };
    }],
    ['GET', /^\/admin\/fixtures$/, async (c) => {
      await c.requireAdmin();
      return { fixtures: await admin.listarFixtures(sql, c.query.get('data') ?? hoje()) };
    }],
    ['POST', /^\/admin\/fixtures\/importar$/, async (c) => {
      await c.requireAdmin();
      return importarOdds(sql, deps.odds, (await c.body()).data ?? hoje());
    }],
    ['POST', /^\/admin\/fixtures$/, async (c) => (await c.requireAdmin(), admin.upsertFixture(sql, await c.body()))],
    ['DELETE', /^\/admin\/fixtures\/([^/]+)$/, async (c) => {
      await c.requireAdmin();
      await admin.removerFixture(sql, c.params[0]);
      return { ok: true };
    }],
    ['GET', /^\/admin\/liga$/, async (c) => (await c.requireAdmin(), admin.ligaAdminPorData(sql, c.query.get('data') ?? hoje()))],
    ['POST', /^\/admin\/liga\/selecionar$/, async (c) => {
      await c.requireAdmin();
      const b = await c.body();
      return admin.selecionarJogos(sql, { data: b.data ?? hoje(), fixture_ids: b.fixture_ids, premio_desc: b.premio_desc });
    }],
    ['PATCH', /^\/admin\/liga\/([^/]+)$/, async (c) => (await c.requireAdmin(), admin.atualizarLiga(sql, c.params[0], await c.body()))],
    ['DELETE', /^\/admin\/liga\/([^/]+)$/, async (c) => (await c.requireAdmin(), admin.removerLiga(sql, c.params[0]))],
    ['DELETE', /^\/admin\/liga\/([^/]+)\/palpiteiros\/([^/]+)$/, async (c) =>
      (await c.requireAdmin(), admin.removerPalpiteiro(sql, c.params[0], c.params[1]))],
    ['GET', /^\/admin\/ligas$/, async (c) => (await c.requireAdmin(), admin.listarLigas(sql))],
    ['POST', /^\/admin\/liga\/([^/]+)\/reativar$/, async (c) => (await c.requireAdmin(), reativarLiga(sql, c.params[0]))],
    ['POST', /^\/admin\/liga\/([^/]+)\/finalizar$/, async (c) => {
      await c.requireAdmin();
      return finalizarLiga(sql, c.params[0], ((await c.body()).mercados_vencedores ?? []) as string[]);
    }],
    ['POST', /^\/admin\/jogos\/([^/]+)\/destaque$/, async (c) => (await c.requireAdmin(), admin.marcarDestaque(sql, c.params[0]))],
    ['GET', /^\/admin\/jogos\/([^/]+)\/mercados-api$/, async (c) => (await c.requireAdmin(), mercadosDaApi(sql, deps.odds, c.params[0]))],
    ['PUT', /^\/admin\/jogos\/([^/]+)\/mercados$/, async (c) => {
      await c.requireAdmin();
      return admin.definirMercados(sql, c.params[0], (await c.body()).mercados);
    }],
    ['POST', /^\/admin\/jogos\/([^/]+)\/mercados-renovar$/, async (c) => {
      await c.requireAdmin();
      return admin.renovarMercadosJogo(sql, deps.odds, c.params[0]);
    }],
  ];

  const cors = {
    'Access-Control-Allow-Origin': deps.corsOrigin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    // Supabase entrega `/api/...` (ou `/functions/v1/api/...`); o dev server pode servir na raiz.
    const path = url.pathname.replace(/^\/functions\/v1/, '').replace(/^\/api(?=\/|$)/, '').replace(/\/+$/, '') || '/';

    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
    let cachedUser: Promise<auth.UserPublico | null> | null = null;
    const user = () => (cachedUser ??= auth.usuarioDaSessao(sql, token));
    const ctxBase = {
      req,
      query: url.searchParams,
      token,
      body: async () => {
        try {
          const b = await req.json();
          return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
        } catch {
          return {};
        }
      },
      user,
      requireUser: async () => auth.exigirUsuario(sql, token),
      requireAdmin: async () => {
        const u = await auth.exigirUsuario(sql, token);
        if (!u.is_admin) throw new ForbiddenError('Acesso restrito ao admin.');
        return u;
      },
    };

    try {
      let methodMismatch = false;
      for (const [method, pattern, handler] of routes) {
        const m = pattern.exec(path);
        if (!m) continue;
        if (method !== req.method) {
          methodMismatch = true;
          continue;
        }
        return json(200, await handler({ ...ctxBase, params: m.slice(1).map(decodeURIComponent) }));
      }
      return json(methodMismatch ? 405 : 404, { error: methodMismatch ? 'Método não permitido.' : 'Rota não encontrada.' });
    } catch (e) {
      if (e instanceof RuleError) return json(e.status, { error: e.message });
      console.error('[api] erro inesperado', e);
      return json(500, { error: 'Algo deu errado. Tente novamente.' });
    }
  };
}
