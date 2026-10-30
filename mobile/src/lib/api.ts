import type {
  CodigoEnviado,
  Config,
  Faixa,
  Fixture,
  Home,
  LigaAdmin,
  Perfil,
  RankingRow,
  User,
} from '../types';

/** URL da Edge Function `api` (ex.: https://<ref>.supabase.co/functions/v1/api) ou do dev server local. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787').replace(/\/+$/, '');

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

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
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
    throw new ApiError('Sem conexão. Verifique sua internet.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Algo deu errado. Tente novamente.', res.status);
  return data as T;
}

export type CadastroInput = {
  nome: string;
  whatsapp: string;
  cpf: string;
  data_nascimento: string;
  bairro: string;
  aceita_termos: boolean;
  aceita_compartilhamento: boolean;
};

export const api = {
  cadastro: (input: CadastroInput) => req<CodigoEnviado>('POST', '/auth/cadastro', input),
  login: (whatsapp: string) => req<CodigoEnviado>('POST', '/auth/login', { whatsapp }),
  reenviar: (whatsapp: string) => req<CodigoEnviado>('POST', '/auth/reenviar', { whatsapp }),
  confirmar: (whatsapp: string, codigo: string) =>
    req<{ token: string; user: User; nova_conta: boolean }>('POST', '/auth/confirmar', { whatsapp, codigo }),
  logout: () => req<{ ok: true }>('POST', '/auth/logout'),

  home: () => req<Home>('GET', '/home'),
  ranking: () => req<{ data: string; liga: { id: string; status: string } | null; ranking: RankingRow[] }>(
    'GET',
    '/liga/hoje/ranking',
  ),
  entrar: () => req<{ fichas_total: number; saldo_pontos: number }>('POST', '/liga/hoje/entrar'),
  apostar: (distribuicao: Record<string, number>) =>
    req<{ fichas_distribuidas: number; fichas_livres: number }>('POST', '/liga/hoje/apostas', { distribuicao }),
  me: () => req<Perfil>('GET', '/me'),

  admin: {
    config: () => req<{ config: Config; premio_escada: Faixa[] }>('GET', '/admin/config'),
    salvarConfig: (c: Partial<Config>) => req<{ config: Config; premio_escada: Faixa[] }>('PUT', '/admin/config', c),
    salvarEscada: (faixas: { usuarios_min: number; valor: number }[]) =>
      req<{ premio_escada: Faixa[] }>('PUT', '/admin/premio-escada', { faixas }),
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
    mercados: (jogoId: string, mercados: { id?: string; descricao: string; multiplicador: number }[]) =>
      req<LigaAdmin>('PUT', `/admin/jogos/${jogoId}/mercados`, { mercados }),
    finalizar: (ligaId: string, mercados_vencedores: string[]) =>
      req<{ premio_final: number; palpiteiros: number; voucher: { codigo: string; valor: number } | null }>(
        'POST',
        `/admin/liga/${ligaId}/finalizar`,
        { mercados_vencedores },
      ),
  },
};
