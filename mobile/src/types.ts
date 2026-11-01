// Tipos das respostas da API (supabase/functions/_core).
export type LigaStatus = "aberta" | "em_andamento" | "finalizada";

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
  grupo: string;
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
  finalizado: boolean;
  placar: { casa: number; fora: number } | null;
  mercados: Mercado[];
};

/** Agrupa mercados consecutivos pelo nome do mercado (grupo); as linhas são as opções. */
export function agruparMercados<M extends { grupo: string }>(ms: M[]) {
  const out: { grupo: string; opcoes: M[] }[] = [];
  for (const m of ms) {
    const g = out.find((x) => x.grupo === m.grupo);
    if (g) g.opcoes.push(m);
    else out.push({ grupo: m.grupo, opcoes: [m] });
  }
  return out;
}

export type Faixa = { ordem: number; usuarios_min: number; valor: number };

export type Premio = {
  palpiteiros: number;
  premio_inicial: number;
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
      multiplas: MultiplaView[];
      pontuacao: number;
      posicao: number | null;
    };

export type Home = {
  data: string;
  regras: { custo_entrada_pontos: number; fichas_por_entrada: number };
  usuario: {
    id: string;
    nome: string;
    saldo_pontos: number;
    is_admin: boolean;
  } | null;
  liga: Liga | null;
  jogos: Jogo[];
  premio: Premio;
  eu: MinhaSituacao | null;
};

export type PernaView = {
  mercado_id: string;
  jogo: string;
  grupo: string;
  descricao: string;
  odd: number;
  resultado_final: boolean;
  comecou: boolean;
  finalizado: boolean;
};

export type MultiplaView = { id: string; fichas: number; odd: number; pernas: PernaView[] };

export type Resultado = "green" | "red" | null;

export type PalpiteiroView = {
  nome: string;
  entrou_em: string;
  eu: boolean;
  posicao: number | null;
  pontuacao: number;
  /** Potencial máximo de pontos (só no próprio bilhete). */
  potencial: number | null;
  /** Simples. Dos outros, só os jogos que já começaram, sem fichas. */
  palpites: {
    jogo: string;
    grupo: string;
    descricao: string;
    multiplicador: number;
    resultado: Resultado;
    fichas?: number;
  }[];
  multiplas: {
    numero: number;
    odd: number;
    ocultas: number;
    fichas?: number;
    pernas: { jogo: string; grupo: string; descricao: string; odd: number; resultado: Resultado }[];
  }[];
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
  vouchers: {
    codigo: string;
    valor: number;
    resgatado: boolean;
    data: string;
  }[];
  historico: {
    liga_id: string;
    data: string;
    status: LigaStatus;
    fichas_total: number;
  }[];
};

export type CodigoEnviado = {
  whatsapp: string;
  destino: string;
  expires_at: string;
  dev_codigo?: string;
};

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
  mercados_sugeridos?: {
    grupo?: string;
    descricao: string;
    multiplicador: number;
  }[];
};

export type Config = {
  qtd_jogos_dia: number;
  fichas_por_entrada: number;
  custo_entrada_pontos: number;
  pontos_boas_vindas: number;
  premio_inicial: number;
};

export type LigaHistorico = {
  id: string;
  data: string;
  status: LigaStatus;
  premio_desc: string | null;
  premio_final: number | null;
  finalizada_em: string | null;
  palpiteiros: number;
  jogos: string[];
  vencedor: string | null;
};

export type LigaAdmin = {
  liga: Liga | null;
  palpiteiros: number;
  participantes: {
    user_id: string;
    nome: string;
    bairro: string;
    fichas_apostadas: number;
  }[];
  jogos: Jogo[];
};
