import * as admin from './admin.ts';
import * as auth from './auth.ts';
import type { Db } from './db.ts';
import { ForbiddenError, NotFoundError, RuleError } from './errors.ts';
import { importarOdds, mercadosDaApi, type OddsConfig } from './odds.ts';
import { apostar, entrarNaLiga, finalizarLiga, reativarLiga, getLigaAtual } from './rules.ts';
import { home, jogosComMercados, perfil, rankingDoDia } from './services.ts';
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
};

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
    ['POST', /^\/liga\/hoje\/entrar$/, async (c) => {
      const u = await c.requireUser();
      return entrarNaLiga(sql, u.id, (await ligaDeHoje()).id);
    }],
    ['POST', /^\/liga\/hoje\/apostas$/, async (c) => {
      const u = await c.requireUser();
      const b = await c.body();
      return apostar(sql, u.id, (await ligaDeHoje()).id, (b.distribuicao ?? {}) as Record<string, number>);
    }],
    ['GET', /^\/me$/, async (c) => perfil(sql, await c.requireUser())],

    // ---- admin (is_admin)
    ['GET', /^\/admin\/config$/, async (c) => (await c.requireAdmin(), admin.configAdmin(sql))],
    ['PUT', /^\/admin\/config$/, async (c) => (await c.requireAdmin(), admin.atualizarConfig(sql, await c.body()))],
    ['PUT', /^\/admin\/premio-escada$/, async (c) => {
      await c.requireAdmin();
      return { premio_escada: await admin.salvarPremioEscada(sql, (await c.body()).faixas) };
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
