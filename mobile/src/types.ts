// Tipos das respostas da API (supabase/functions/_core).
export type LigaStatus = 'aberta' | 'em_andamento' | 'finalizada';

export type User = {
  id: string;
  nome: string;
  whatsapp: string;
  bairro: string;
  saldo_pontos: number;
  is_admin: boolean;
  created_at: string;
};

export type Liga = {
  id: string;
  data: string;
  premio_desc: string | null;
  premio_final: number | null;
  status: LigaStatus;
  custo_entrada: number;
  fichas_por_entrada: number;
};

export type Mercado = {
  id: string;
  descricao: string;
  multiplicador: number;
  resultado_final: boolean;
  minhas_fichas?: number;
};

export type Jogo = {
  id: string;
  fixture_id: number;
  time_casa: string;
  time_fora: string;
  horario: string;
  campeonato: string;
  destaque: boolean;
  comecou: boolean;
  mercados: Mercado[];
};

export type Faixa = { ordem: number; usuarios_min: number; valor: number };

export type Premio = {
  palpiteiros: number;
  premio_atual: number;
  proxima: { usuarios_min: number; valor: number; faltam: number } | null;
  meta: { usuarios_min: number; valor: number } | null;
  faltam_meta: number;
  meta_atingida: boolean;
  escada: Faixa[];
};

export type MinhaSituacao =
  | { entrou: false }
  | {
      entrou: true;
      fichas_total: number;
      fichas_usadas: number;
      fichas_livres: number;
      pontuacao: number;
      posicao: number | null;
    };

export type Home = {
  data: string;
  regras: { custo_entrada_pontos: number; fichas_por_entrada: number };
  usuario: { id: string; nome: string; saldo_pontos: number; is_admin: boolean } | null;
  liga: Liga | null;
  jogos: Jogo[];
  premio: Premio;
  eu: MinhaSituacao | null;
};

export type RankingRow = {
  posicao: number;
  nome: string;
  bairro: string;
  pontuacao: number;
  fichas_apostadas: number;
  primeira_aposta_em: string | null;
  eu: boolean;
};

export type Perfil = {
  user: User;
  vouchers: { codigo: string; valor: number; resgatado: boolean; data: string }[];
  historico: { liga_id: string; data: string; status: LigaStatus; fichas_total: number }[];
};

export type CodigoEnviado = { whatsapp: string; destino: string; expires_at: string; dev_codigo?: string };

export type Fixture = {
  id: string;
  fixture_id: number;
  data: string;
  time_casa: string;
  time_fora: string;
  horario: string;
  campeonato: string;
  selecionado: boolean;
  fonte?: string;
  mercados_sugeridos?: { descricao: string; multiplicador: number }[];
};

export type Config = {
  qtd_jogos_dia: number;
  fichas_por_entrada: number;
  custo_entrada_pontos: number;
  pontos_boas_vindas: number;
};

export type LigaAdmin = { liga: Liga | null; palpiteiros: number; jogos: Jogo[] };
