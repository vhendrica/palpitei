import { track } from './analytics';
import type {
  CriarDesafioInput,
  HistoricoItem,
  DesafioDetalhe,
  DesafioResumo,
  MeuBilhete,
  CodigoEnviado,
  Config,
  Faixa,
  Fixture,
  Home,
  LigaAdmin, LigaHistorico,
  PalpiteiroView,
  Perfil,
  RankingRow,
  SimResumo,
  User,
} from '../types';

/** URL da Edge Function `api` (ex.: https://<ref>.supabase.co/functions/v1/api) ou do dev server local. */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'https://mkhpkguwjwtoxsgwcgmm.supabase.co/functions/v1/api'
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let token: string | null = null;
export const setToken = (t: string | null) => {
  token = t;
};

// Feedback global: contador de requests em voo (loading) + erros (toast).
let onLoadingChange: ((carregando: boolean) => void) | null = null;
let onApiError: ((mensagem: string) => void) | null = null;
let emVoo = 0;
const sinalizaLoading = (delta: number) => {
  emVoo = Math.max(0, emVoo + delta);
  onLoadingChange?.(emVoo > 0);
};
export function wireFeedback(handlers: {
  onLoadingChange: (carregando: boolean) => void;
  onApiError: (mensagem: string) => void;
}) {
  onLoadingChange = handlers.onLoadingChange;
  onApiError = handlers.onApiError;
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { silencioso?: boolean; semToast?: boolean },
): Promise<T> {
  let res: Response;
  // A tela escura fica só pra gravações: leitura mostra esqueleto na própria tela.
  // (O admin não tem esqueleto, então as leituras dele mantêm o overlay.)
  const silencioso = !!opts?.silencioso || (method === 'GET' && !path.startsWith('/admin'));
  if (!silencioso) sinalizaLoading(1);
  try {
    try {
      res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      track('Erro na API', { path, status: 0 });
      throw new ApiError('Sem conexão. Verifique sua internet.', 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const erro = new ApiError(data.error ?? 'Algo deu errado. Tente novamente.', res.status);
      // 4xx é erro esperado do usuário (código errado etc.); 5xx é bug/queda — loga.
      if (res.status >= 500) track('Erro na API', { path, status: res.status });
      if (res.status !== 401 && !opts?.semToast) onApiError?.(erro.message);
      throw erro;
    }
    return data as T;
  } finally {
    if (!silencioso) sinalizaLoading(-1);
  }
}

export type CadastroInput = {
  nome: string;
  email: string;
  senha: string;
  whatsapp: string;
  cpf: string;
  data_nascimento: string;
  bairro?: string;
  aceita_termos: boolean;
  aceita_compartilhamento: boolean;
};

export type Sessao = { token: string; user: User; nova_conta: boolean };

export type BilheteInput = {
  simples: Record<string, number>;
  multiplas: { mercados: string[]; fichas: number }[];
};

export const api = {
  // Login e cadastro mostram o erro no próprio formulário (sem toast duplicado).
  cadastro: (input: CadastroInput) => req<Sessao>('POST', '/auth/cadastro', input, { semToast: true }),
  login: (email: string, senha: string) =>
    req<Sessao>('POST', '/auth/login', { email, senha }, { semToast: true }),
  // OTP WhatsApp dormente — reativar quando a verificação voltar.
  otpLogin: (whatsapp: string) => req<CodigoEnviado>('POST', '/auth/otp/login', { whatsapp }),
  otpReenviar: (whatsapp: string) => req<CodigoEnviado>('POST', '/auth/otp/reenviar', { whatsapp }),
  otpConfirmar: (whatsapp: string, codigo: string) =>
    req<Sessao>('POST', '/auth/otp/confirmar', { whatsapp, codigo }),
  logout: () => req<{ ok: true }>('POST', '/auth/logout'),
  esqueciSenha: (email: string) =>
    req<{ ok: true; mensagem: string }>('POST', '/auth/senha/esqueci', { email }, { semToast: true }),
  redefinirSenha: (token: string, senha: string) =>
    req<{ ok: true }>('POST', '/auth/senha/redefinir', { token, senha }, { semToast: true }),

  home: () => req<Home>('GET', '/home'),
  ranking: () => req<{ data: string; liga: { id: string; status: string } | null; ranking: RankingRow[] }>(
    'GET',
    '/liga/hoje/ranking',
  ),
  palpiteiros: (silencioso = false) =>
    req<{ data: string; liga: { id: string; status: string } | null; palpiteiros: PalpiteiroView[] }>(
      'GET',
      '/liga/hoje/palpiteiros',
      undefined,
      { silencioso },
    ),
  entrar: () => req<{ fichas_total: number; saldo_pontos: number }>('POST', '/liga/hoje/entrar'),
  apostar: (bilhete: BilheteInput) =>
    req<{ fichas_distribuidas: number; fichas_livres: number }>('POST', '/liga/hoje/apostas', bilhete),
  editarApostas: (bilhete: BilheteInput) =>
    req<{ fichas_distribuidas: number; fichas_livres: number }>('PUT', '/liga/hoje/apostas', bilhete),
  me: () => req<Perfil>('GET', '/me'),
  sim: {
    resumo: () => req<SimResumo>('GET', '/sim'),
    recarga: (valor: number) => req<{ estourou: boolean }>('POST', '/sim/recarga', { valor }),
    /** mercado_ids com 1 id = aposta simples; 2+ = múltipla (acumulada). */
    apostar: (mercado_ids: string[], valor: number) =>
      req<{ ok: true }>('POST', '/sim/apostar', { mercado_ids, valor }),
  },
  atualizarPerfil: (input: { nome: string; bairro: string }) => req<{ user: User }>('PUT', '/me', input),

  desafios: {
    listar: (busca?: string) =>
      req<{ meus: DesafioResumo[]; publicos: DesafioResumo[] }>('GET', `/desafios${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`),
    fixtures: (data: string) => req<{ fixtures: Fixture[] }>('GET', `/desafios/fixtures?data=${data}`),
    fixtureMercados: (fixtureId: number) =>
      req<{ mercados_sugeridos: { grupo: string; descricao: string; multiplicador: number }[] }>(
        'GET',
        `/desafios/fixture-mercados?fixture_id=${fixtureId}`,
      ),
    criar: (input: CriarDesafioInput) => req<{ id: string; convite: string }>('POST', '/desafios', input),
    convite: (token: string) => req<{ desafio: DesafioResumo }>('GET', `/desafios/convite/${encodeURIComponent(token)}`),
    detalhe: (id: string) => req<DesafioDetalhe>('GET', `/desafios/${id}`),
    entrar: (id: string, convite?: string) => req<{ entrada_id: string; fichas_total: number; saldo_pontos: number }>(
      'POST',
      `/desafios/${id}/entrar`,
      { convite },
    ),
        placar: (id: string, jogoId: string, casa: number, fora: number) =>
      req<{ jogo_id: string; placar: [number, number]; mercados_certos: number }>(
        'POST',
        `/desafios/${id}/jogos/${jogoId}/placar`,
        { casa, fora },
      ),
    apostar: (id: string, bilhete: BilheteInput) =>
      req<{ fichas_distribuidas: number; fichas_livres: number }>('PUT', `/desafios/${id}/apostas`, bilhete),
    palpiteiros: (id: string) =>
      req<{ data: string; liga: { id: string; status: string }; palpiteiros: PalpiteiroView[] }>(
        'GET',
        `/desafios/${id}/palpiteiros`,
      ),
    finalizar: (id: string) => req<{ ranking: RankingRow[] }>('POST', `/desafios/${id}/finalizar`),
  },
  historico: () => req<{ historico: HistoricoItem[] }>('GET', '/historico'),
  meuBilhete: (ligaId: string) => req<MeuBilhete>('GET', `/historico/${ligaId}`),
  admin: {
    config: () => req<{ config: Config; premio_escada: Faixa[] }>('GET', '/admin/config'),
    salvarConfig: (c: Partial<Config>) => req<{ config: Config; premio_escada: Faixa[] }>('PUT', '/admin/config', c),
    salvarEscada: (faixas: { usuarios_min: number; valor: number }[], premio_inicial?: number) =>
      req<{ premio_escada: Faixa[] }>('PUT', '/admin/premio-escada', { faixas, premio_inicial }),
    fixtures: (data: string) => req<{ fixtures: Fixture[] }>('GET', `/admin/fixtures?data=${data}`),
    importarOdds: (data: string) =>
      req<{ importados: { fixture_id: number }[]; creditos_restantes: number | null }>('POST', '/admin/fixtures/importar', { data }),
    salvarFixture: (f: Omit<Fixture, 'id' | 'selecionado'>) => req<Fixture>('POST', '/admin/fixtures', f),
    removerFixture: (id: string) => req<{ ok: true }>('DELETE', `/admin/fixtures/${id}`),
    liga: (data: string) => req<LigaAdmin>('GET', `/admin/liga?data=${data}`),
    selecionar: (data: string, fixture_ids: number[], premio_desc?: string) =>
      req<LigaAdmin>('POST', '/admin/liga/selecionar', { data, fixture_ids, premio_desc }),
    atualizarLiga: (id: string, body: { status?: string; premio_desc?: string | null }) =>
      req<LigaAdmin>('PATCH', `/admin/liga/${id}`, body),
    destaque: (jogoId: string) => req<LigaAdmin>('POST', `/admin/jogos/${jogoId}/destaque`),
    especial: (mercadoId: string) => req<LigaAdmin>('POST', `/admin/mercados/${mercadoId}/especial`),
    mercadosApi: (jogoId: string) =>
      req<{
        mercados: { grupo: string; descricao: string; multiplicador: number; casas: number }[];
        creditos_restantes: number | null;
      }>('GET', `/admin/jogos/${jogoId}/mercados-api`),
    mercados: (jogoId: string, mercados: { id?: string; grupo: string; descricao: string; multiplicador: number }[]) =>
      req<LigaAdmin>('PUT', `/admin/jogos/${jogoId}/mercados`, { mercados }),
    renovarMercados: (jogoId: string) =>
      req<{ jogo_id: string; mercados: number }>('POST', `/admin/jogos/${jogoId}/mercados-renovar`),
    ligas: () => req<{ ligas: LigaHistorico[] }>('GET', '/admin/ligas'),
    palpiteiros: (ligaId: string) =>
      req<{ data: string; liga: { id: string; status: string } | null; palpiteiros: PalpiteiroView[] }>(
        'GET',
        `/admin/liga/${ligaId}/palpiteiros`,
      ),
    removerPalpiteiro: (ligaId: string, userId: string) =>
      req<LigaAdmin>('DELETE', `/admin/liga/${ligaId}/palpiteiros/${userId}`),
    reativar: (ligaId: string) => req<{ ok: true }>('POST', `/admin/liga/${ligaId}/reativar`),
    removerLiga: (ligaId: string) => req<{ removida: string }>('DELETE', `/admin/liga/${ligaId}`),
    finalizar: (ligaId: string, mercados_vencedores: string[]) =>
      req<{ premio_final: number; palpiteiros: number; voucher: { codigo: string; valor: number } | null }>(
        'POST',
        `/admin/liga/${ligaId}/finalizar`,
        { mercados_vencedores },
      ),
  },
};
