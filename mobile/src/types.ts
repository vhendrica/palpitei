export type User = {
  id: string;
  name: string;
  whatsapp: string;
  bairro: string;
  saldo_pontos: number;
  is_premium: boolean;
  created_at: string;
};

export type LigaStatus = 'aberta' | 'em_andamento' | 'finalizada';

export type Liga = {
  id: string;
  nome_jogo: string;
  data_jogo: string;
  local: string;
  premio_desc: string;
  custo_entrada: number;
  status: LigaStatus;
};

export type Mercado = {
  id: string;
  liga_id: string;
  descricao: string;
  multiplicador: number;
  resultado_final: boolean;
};

export type Aposta = {
  id: string;
  user_id: string;
  liga_id: string;
  mercado_id: string;
  fichas_apostadas: number;
  created_at: string;
};

export type AnuncioTipo = 'banner' | 'interstitial';

export type Anuncio = {
  id: string;
  tipo: AnuncioTipo;
  anunciante: string;
  imagem_url: string;
  link: string;
  bairro_alvo: string | null;
  status: 'ativo' | 'inativo';
};

/** Registro de quem pagou a entrada (PONTOS) e recebeu as FICHAS da liga. */
export type Entrada = {
  id: string;
  user_id: string;
  liga_id: string;
  pontos_pagos: number;
  fichas_total: number;
  created_at: string;
};

export type Voucher = {
  id: string;
  user_id: string;
  liga_id: string;
  codigo: string;
  premio_desc: string;
  pontos_devolvidos: number;
  created_at: string;
};

export type DB = {
  users: User[];
  ligas: Liga[];
  mercados: Mercado[];
  apostas: Aposta[];
  anuncios: Anuncio[];
  entradas: Entrada[];
  vouchers: Voucher[];
};

export type RankingRow = {
  posicao: number;
  user: User;
  pontuacao: number;
  fichas_apostadas: number;
};
