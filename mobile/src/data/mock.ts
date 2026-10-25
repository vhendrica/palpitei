import { FICHAS_POR_LIGA } from '../lib/constants';
import type { Anuncio, Aposta, DB, Entrada, Liga, Mercado, User, Voucher } from '../types';

const img = (w: number, h: number, bg: string, fg: string, text: string) =>
  `https://placehold.co/${w}x${h}/${bg}/${fg}/png?font=montserrat&text=${encodeURIComponent(text)}`;

const users: User[] = [
  { id: 'u_leao', name: 'Raimundo Leão', whatsapp: '85988110001', bairro: 'Aldeota', saldo_pontos: 300, is_premium: false, created_at: '2026-09-01T10:00:00Z' },
  { id: 'u_vozao', name: 'Francisco Alves', whatsapp: '85988110002', bairro: 'Benfica', saldo_pontos: 400, is_premium: false, created_at: '2026-09-02T10:00:00Z' },
  { id: 'u_tico', name: 'Tiago Moreira', whatsapp: '85988110003', bairro: 'Montese', saldo_pontos: 400, is_premium: true, created_at: '2026-09-03T10:00:00Z' },
  { id: 'u_bia', name: 'Bruno Lima', whatsapp: '85988110004', bairro: 'Messejana', saldo_pontos: 300, is_premium: false, created_at: '2026-09-04T10:00:00Z' },
  { id: 'u_ze', name: 'José Pereira', whatsapp: '85988110005', bairro: 'Parangaba', saldo_pontos: 300, is_premium: false, created_at: '2026-09-05T10:00:00Z' },
  { id: 'u_lu', name: 'Lucas Rocha', whatsapp: '85988110006', bairro: 'Meireles', saldo_pontos: 400, is_premium: false, created_at: '2026-09-06T10:00:00Z' },
  { id: 'u_caio', name: 'Caio Nogueira', whatsapp: '85988110007', bairro: 'Papicu', saldo_pontos: 400, is_premium: false, created_at: '2026-09-07T10:00:00Z' },
  { id: 'u_nanda', name: 'Fernando Costa', whatsapp: '85988110008', bairro: 'Centro', saldo_pontos: 400, is_premium: false, created_at: '2026-09-08T10:00:00Z' },
  { id: 'u_antonio', name: 'Antônio Barros', whatsapp: '85988110009', bairro: 'Cocó', saldo_pontos: 300, is_premium: false, created_at: '2026-09-09T10:00:00Z' },
  { id: 'u_marcos', name: 'Marcos Holanda', whatsapp: '85988110010', bairro: 'Fátima', saldo_pontos: 300, is_premium: false, created_at: '2026-09-10T10:00:00Z' },
  { id: 'u_pedro', name: 'Pedro Cavalcante', whatsapp: '85988110011', bairro: 'Edson Queiroz', saldo_pontos: 300, is_premium: false, created_at: '2026-09-11T10:00:00Z' },
  { id: 'u_rafael', name: 'Rafael Girão', whatsapp: '85988110012', bairro: 'Praia de Iracema', saldo_pontos: 300, is_premium: false, created_at: '2026-09-12T10:00:00Z' },
];

const ligas: Liga[] = [
  { id: 'l_classico', nome_jogo: 'Fortaleza x Ceará', data_jogo: '2026-11-01T19:00:00Z', local: 'Arena Castelão', premio_desc: 'Camisa oficial 2026 do seu time + voucher adidas de 250 reais', custo_entrada: 100, status: 'aberta' },
  { id: 'l_cea_fer', nome_jogo: 'Ceará x Ferroviário', data_jogo: '2026-10-29T22:30:00Z', local: 'Estádio Presidente Vargas', premio_desc: 'Rodízio para 2 na Picanharia Meireles', custo_entrada: 100, status: 'aberta' },
  { id: 'l_for_bah', nome_jogo: 'Fortaleza x Bahia', data_jogo: '2026-10-25T23:00:00Z', local: 'Arena Castelão', premio_desc: 'Estadia no final de semana no Beach Park para 2 pessoas', custo_entrada: 100, status: 'em_andamento' },
  { id: 'l_flo_for', nome_jogo: 'Floresta x Fortaleza', data_jogo: '2026-10-18T21:00:00Z', local: 'Estádio Domingão', premio_desc: 'Kit torcedor (camisa + boné)', custo_entrada: 100, status: 'finalizada' },
];

const m = (id: string, liga_id: string, descricao: string, multiplicador: number, resultado_final = false): Mercado => ({
  id,
  liga_id,
  descricao,
  multiplicador,
  resultado_final,
});

const mercados: Mercado[] = [
  m('m_cl_for', 'l_classico', 'FORTALEZA VENCE', 2.1),
  m('m_cl_emp', 'l_classico', 'EMPATE', 3.2),
  m('m_cl_cea', 'l_classico', 'CEARÁ VENCE', 3.5),
  m('m_cl_amb', 'l_classico', 'AMBOS MARCAM', 1.85),
  m('m_cl_o25', 'l_classico', 'MAIS DE 2.5 GOLS', 2.4),
  m('m_cl_luc', 'l_classico', 'LUCERO MARCA', 2.75),
  m('m_cl_u25', 'l_classico', 'MENOS DE 2.5 GOLS', 1.6),
  m('m_cl_dpl', 'l_classico', 'FORTALEZA OU EMPATE', 1.35),
  m('m_cl_dpc', 'l_classico', 'CEARÁ OU EMPATE', 1.7),
  m('m_cl_g1t', 'l_classico', 'GOL NO 1º TEMPO', 1.7),
  m('m_cl_esc', 'l_classico', 'MAIS DE 8.5 ESCANTEIOS', 2.05),
  m('m_cl_pen', 'l_classico', 'TEM PÊNALTI', 2.8),
  m('m_cl_ver', 'l_classico', 'TEM CARTÃO VERMELHO', 3.9),

  m('m_cf_cea', 'l_cea_fer', 'CEARÁ VENCE', 1.6),
  m('m_cf_emp', 'l_cea_fer', 'EMPATE', 3.6),
  m('m_cf_fer', 'l_cea_fer', 'FERROVIÁRIO VENCE', 5.0),
  m('m_cf_u25', 'l_cea_fer', 'MENOS DE 2.5 GOLS', 1.9),
  m('m_cf_pen', 'l_cea_fer', 'TEM PÊNALTI', 2.9),
  m('m_cf_amb', 'l_cea_fer', 'AMBOS MARCAM', 2.1),
  m('m_cf_o25', 'l_cea_fer', 'MAIS DE 2.5 GOLS', 2.2),
  m('m_cf_dpf', 'l_cea_fer', 'FERROVIÁRIO OU EMPATE', 2.0),
  m('m_cf_ht', 'l_cea_fer', 'CEARÁ VENCE O 1º TEMPO', 2.3),
  m('m_cf_car', 'l_cea_fer', 'MAIS DE 4.5 CARTÕES', 1.95),

  m('m_fb_for', 'l_for_bah', 'FORTALEZA VENCE', 2.3),
  m('m_fb_emp', 'l_for_bah', 'EMPATE', 3.1),
  m('m_fb_bah', 'l_for_bah', 'BAHIA VENCE', 3.0),
  m('m_fb_amb', 'l_for_bah', 'AMBOS MARCAM', 1.75),
  m('m_fb_o25', 'l_for_bah', 'MAIS DE 2.5 GOLS', 2.15),
  m('m_fb_u25', 'l_for_bah', 'MENOS DE 2.5 GOLS', 1.7),
  m('m_fb_dpl', 'l_for_bah', 'FORTALEZA OU EMPATE', 1.4),
  m('m_fb_g1t', 'l_for_bah', 'GOL NO 1º TEMPO', 1.65),
  m('m_fb_esc', 'l_for_bah', 'MAIS DE 9.5 ESCANTEIOS', 2.3),
  m('m_fb_pen', 'l_for_bah', 'TEM PÊNALTI', 2.85),

  m('m_ff_flo', 'l_flo_for', 'FLORESTA VENCE', 6.0),
  m('m_ff_emp', 'l_flo_for', 'EMPATE', 3.8, false),
  m('m_ff_for', 'l_flo_for', 'FORTALEZA VENCE', 1.45, true),
  m('m_ff_o25', 'l_flo_for', 'MAIS DE 2.5 GOLS', 2.2, true),
  m('m_ff_luc', 'l_flo_for', 'LUCERO MARCA', 2.5, false),
  m('m_ff_amb', 'l_flo_for', 'AMBOS MARCAM', 2.0, false),
  m('m_ff_g1t', 'l_flo_for', 'GOL NO 1º TEMPO', 1.6, true),
  m('m_ff_car', 'l_flo_for', 'MAIS DE 4.5 CARTÕES', 2.1, false),
  m('m_ff_ht', 'l_flo_for', 'FORTALEZA VENCE O 1º TEMPO', 2.6, false),
];

const entradasSeed: [string, string, string][] = [
  ['u_leao', 'l_classico', '2026-10-20T12:00:00Z'],
  ['u_vozao', 'l_classico', '2026-10-20T13:00:00Z'],
  ['u_tico', 'l_classico', '2026-10-21T09:00:00Z'],
  ['u_bia', 'l_classico', '2026-10-21T18:00:00Z'],
  ['u_ze', 'l_classico', '2026-10-22T08:00:00Z'],
  ['u_vozao', 'l_cea_fer', '2026-10-22T12:00:00Z'],
  ['u_lu', 'l_cea_fer', '2026-10-23T12:00:00Z'],
  ['u_caio', 'l_cea_fer', '2026-10-23T15:00:00Z'],
  ['u_leao', 'l_for_bah', '2026-10-19T12:00:00Z'],
  ['u_nanda', 'l_for_bah', '2026-10-19T14:00:00Z'],
  ['u_bia', 'l_for_bah', '2026-10-20T10:00:00Z'],
  ['u_leao', 'l_flo_for', '2026-10-15T12:00:00Z'],
  ['u_tico', 'l_flo_for', '2026-10-15T13:00:00Z'],
  ['u_ze', 'l_flo_for', '2026-10-16T13:00:00Z'],
  ['u_bia', 'l_flo_for', '2026-10-16T14:00:00Z'],
  ['u_antonio', 'l_classico', '2026-10-22T10:00:00Z'],
  ['u_marcos', 'l_classico', '2026-10-22T11:00:00Z'],
  ['u_rafael', 'l_classico', '2026-10-23T09:00:00Z'],
  ['u_antonio', 'l_cea_fer', '2026-10-23T10:00:00Z'],
  ['u_pedro', 'l_cea_fer', '2026-10-23T11:00:00Z'],
  ['u_marcos', 'l_for_bah', '2026-10-20T11:00:00Z'],
  ['u_pedro', 'l_for_bah', '2026-10-20T12:00:00Z'],
  ['u_rafael', 'l_flo_for', '2026-10-16T15:00:00Z'],
];

const entradas: Entrada[] = entradasSeed.map(([user_id, liga_id, created_at], i) => ({
  id: `e_seed_${i}`,
  user_id,
  liga_id,
  pontos_pagos: 100,
  fichas_total: FICHAS_POR_LIGA,
  created_at,
}));

const apostasSeed: [string, string, string, number][] = [
  ['u_leao', 'l_classico', 'm_cl_for', 120],
  ['u_leao', 'l_classico', 'm_cl_luc', 80],
  ['u_vozao', 'l_classico', 'm_cl_cea', 140],
  ['u_vozao', 'l_classico', 'm_cl_amb', 60],
  ['u_tico', 'l_classico', 'm_cl_emp', 100],
  ['u_tico', 'l_classico', 'm_cl_o25', 100],
  ['u_bia', 'l_classico', 'm_cl_for', 200],
  ['u_ze', 'l_classico', 'm_cl_amb', 80],
  ['u_ze', 'l_classico', 'm_cl_cea', 60],

  ['u_vozao', 'l_cea_fer', 'm_cf_cea', 200],
  ['u_lu', 'l_cea_fer', 'm_cf_cea', 100],
  ['u_lu', 'l_cea_fer', 'm_cf_u25', 100],
  ['u_caio', 'l_cea_fer', 'm_cf_fer', 60],
  ['u_caio', 'l_cea_fer', 'm_cf_pen', 140],

  ['u_leao', 'l_for_bah', 'm_fb_for', 200],
  ['u_nanda', 'l_for_bah', 'm_fb_bah', 100],
  ['u_nanda', 'l_for_bah', 'm_fb_amb', 100],
  ['u_bia', 'l_for_bah', 'm_fb_emp', 160],

  ['u_leao', 'l_flo_for', 'm_ff_for', 100],
  ['u_leao', 'l_flo_for', 'm_ff_luc', 100],
  ['u_tico', 'l_flo_for', 'm_ff_for', 120],
  ['u_tico', 'l_flo_for', 'm_ff_o25', 80],
  ['u_ze', 'l_flo_for', 'm_ff_flo', 200],
  ['u_bia', 'l_flo_for', 'm_ff_emp', 100],
  ['u_bia', 'l_flo_for', 'm_ff_o25', 60],

  ['u_antonio', 'l_classico', 'm_cl_dpl', 120],
  ['u_antonio', 'l_classico', 'm_cl_esc', 80],
  ['u_marcos', 'l_classico', 'm_cl_ver', 40],
  ['u_marcos', 'l_classico', 'm_cl_o25', 160],
  ['u_rafael', 'l_classico', 'm_cl_cea', 100],
  ['u_rafael', 'l_classico', 'm_cl_g1t', 100],
  ['u_antonio', 'l_cea_fer', 'm_cf_amb', 100],
  ['u_antonio', 'l_cea_fer', 'm_cf_o25', 100],
  ['u_pedro', 'l_cea_fer', 'm_cf_cea', 160],
  ['u_pedro', 'l_cea_fer', 'm_cf_ht', 40],
  ['u_marcos', 'l_for_bah', 'm_fb_o25', 120],
  ['u_marcos', 'l_for_bah', 'm_fb_pen', 80],
  ['u_pedro', 'l_for_bah', 'm_fb_for', 100],
  ['u_pedro', 'l_for_bah', 'm_fb_g1t', 100],
  ['u_rafael', 'l_flo_for', 'm_ff_flo', 80],
  ['u_rafael', 'l_flo_for', 'm_ff_emp', 120],
];

const apostas: Aposta[] = apostasSeed.map(([user_id, liga_id, mercado_id, fichas_apostadas], i) => ({
  id: `a_seed_${i}`,
  user_id,
  liga_id,
  mercado_id,
  fichas_apostadas,
  created_at: '2026-10-20T12:00:00Z',
}));

// Tiago: 120*1.45 + 80*2.2 = 350 pts -> 1º lugar em Floresta x Fortaleza (já recebeu +100 no saldo).
const vouchers: Voucher[] = [
  {
    id: 'v_seed_1',
    user_id: 'u_tico',
    liga_id: 'l_flo_for',
    codigo: 'PT-TIA0FF',
    premio_desc: 'Kit torcedor (camisa + boné)',
    pontos_devolvidos: 100,
    created_at: '2026-10-19T02:00:00Z',
  },
];

const anuncios: Anuncio[] = [
  { id: 'ad_b_acai', tipo: 'banner', anunciante: 'Açaí do Bairro', imagem_url: img(640, 200, '7B2CBF', 'FFFFFF', 'AÇAÍ DO BAIRRO\n2 por R$ 25 - Aldeota'), link: 'https://wa.me/5585999990001', bairro_alvo: 'Aldeota', status: 'ativo' },
  { id: 'ad_b_farm', tipo: 'banner', anunciante: 'Farmácia do Povo', imagem_url: img(640, 200, '0057B8', 'FFFFFF', 'FARMÁCIA DO POVO\nEntrega grátis em Fortaleza'), link: 'https://wa.me/5585999990002', bairro_alvo: null, status: 'ativo' },
  { id: 'ad_b_barraca', tipo: 'banner', anunciante: 'Barraca Sol & Mar', imagem_url: img(640, 200, 'FF8C00', '121212', 'BARRACA SOL & MAR\nCaranguejo toda quinta - Praia do Futuro'), link: 'https://wa.me/5585999990003', bairro_alvo: null, status: 'ativo' },
  { id: 'ad_b_fit', tipo: 'banner', anunciante: 'Messejana Fit', imagem_url: img(640, 200, '00FF88', '121212', 'MESSEJANA FIT\n1ª semana grátis'), link: 'https://wa.me/5585999990004', bairro_alvo: 'Messejana', status: 'ativo' },
  { id: 'ad_b_pizza', tipo: 'banner', anunciante: 'Pizzaria Benfica', imagem_url: img(640, 200, 'C1121F', 'FFFFFF', 'PIZZARIA BENFICA\nGrande + refri por R$ 49'), link: 'https://wa.me/5585999990005', bairro_alvo: 'Benfica', status: 'ativo' },
  { id: 'ad_b_off', tipo: 'banner', anunciante: 'Campanha pausada', imagem_url: img(640, 200, '333333', 'FFFFFF', 'INATIVO'), link: 'https://example.com', bairro_alvo: null, status: 'inativo' },

  { id: 'ad_i_flores', tipo: 'interstitial', anunciante: 'Floricultura Jardim de Iracema', imagem_url: 'local:flores', link: 'https://wa.me/5585999990009', bairro_alvo: null, status: 'ativo' },
  { id: 'ad_i_loja', tipo: 'interstitial', anunciante: 'Loja do Torcedor', imagem_url: img(1080, 1920, '121212', '00FF88', 'LOJA DO\nTORCEDOR\n\nCamisas 2026\n10% OFF\n\nCupom LIGAFOR'), link: 'https://wa.me/5585999990006', bairro_alvo: null, status: 'inativo' },
  { id: 'ad_i_pic', tipo: 'interstitial', anunciante: 'Picanharia Meireles', imagem_url: img(1080, 1920, '8B0000', 'FFFFFF', 'PICANHARIA MEIRELES\n\nRodízio no dia do Clássico\nR$ 69,90'), link: 'https://wa.me/5585999990007', bairro_alvo: 'Meireles', status: 'inativo' },
  { id: 'ad_i_moto', tipo: 'interstitial', anunciante: 'Moto Peças Parangaba', imagem_url: img(1080, 1920, 'FFC83D', '121212', 'MOTO PEÇAS PARANGABA\n\nRevisão completa\nem até 10x'), link: 'https://wa.me/5585999990008', bairro_alvo: 'Parangaba', status: 'inativo' },
];

export function createMockDB(): DB {
  return JSON.parse(
    JSON.stringify({ users, ligas, mercados, apostas, anuncios, entradas, vouchers } satisfies DB),
  ) as DB;
}
