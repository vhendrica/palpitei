import type { Anuncio, AnuncioTipo, DB, Entrada, Liga, RankingRow, User, Voucher } from '../types';
import { CUSTO_ENTRADA_PADRAO, FICHAS_POR_LIGA, SALDO_INICIAL_PONTOS } from './constants';

/**
 * REGRA DE OURO
 * - PONTOS = saldo do perfil (users.saldo_pontos), vive FORA da liga.
 * - FICHAS = só existem DENTRO da liga. Entrar custa `custo_entrada` PONTOS e dá FICHAS_POR_LIGA fichas.
 * - Apostar distribui FICHAS em mercados (apostas.fichas_apostadas) e NUNCA mexe em saldo_pontos.
 * - Ranking = SUM(fichas_apostadas * multiplicador) WHERE mercados.resultado_final = true.
 */

export class RuleError extends Error {}

const now = () => new Date().toISOString();

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const round2 = (n: number) => Math.round(n * 100) / 100;

function getLiga(db: DB, ligaId: string): Liga {
  const liga = db.ligas.find((l) => l.id === ligaId);
  if (!liga) throw new RuleError('Palpite não encontrado.');
  return liga;
}

function getUser(db: DB, userId: string): User {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new RuleError('Usuário não encontrado.');
  return user;
}

export function criarUsuario(
  db: DB,
  input: { name: string; whatsapp: string; bairro: string },
): { db: DB; user: User } {
  const name = input.name.trim();
  const whatsapp = input.whatsapp.replace(/\D/g, '');
  const bairro = input.bairro.trim();
  if (name.length < 2) throw new RuleError('Informe seu nome.');
  if (whatsapp.length < 10 || whatsapp.length > 11) throw new RuleError('WhatsApp inválido. Use DDD + número.');
  if (!bairro) throw new RuleError('Escolha seu bairro.');

  const user: User = {
    id: uid('u'),
    name,
    whatsapp,
    bairro,
    saldo_pontos: SALDO_INICIAL_PONTOS,
    is_premium: false,
    created_at: now(),
  };
  return { db: { ...db, users: [...db.users, user] }, user };
}

export function getEntrada(db: DB, userId: string, ligaId: string): Entrada | undefined {
  return db.entradas.find((e) => e.user_id === userId && e.liga_id === ligaId);
}

export function fichasUsadas(db: DB, userId: string, ligaId: string): number {
  return db.apostas
    .filter((a) => a.user_id === userId && a.liga_id === ligaId)
    .reduce((sum, a) => sum + a.fichas_apostadas, 0);
}

export function fichasDisponiveis(db: DB, userId: string, ligaId: string): number {
  const entrada = getEntrada(db, userId, ligaId);
  if (!entrada) return 0;
  return Math.max(0, entrada.fichas_total - fichasUsadas(db, userId, ligaId));
}

/** Paga a entrada em PONTOS e recebe as FICHAS da liga. */
export function entrarNaLiga(db: DB, userId: string, ligaId: string): DB {
  const user = getUser(db, userId);
  const liga = getLiga(db, ligaId);
  const custo = liga.custo_entrada ?? CUSTO_ENTRADA_PADRAO;

  if (liga.status !== 'aberta') throw new RuleError('Esse palpite não está aberto para entrada.');
  if (getEntrada(db, userId, ligaId)) throw new RuleError('Você já está nesse palpite.');
  if (user.saldo_pontos < custo) throw new RuleError(`Saldo insuficiente. Você precisa de ${custo} PONTOS.`);

  const entrada: Entrada = {
    id: uid('e'),
    user_id: userId,
    liga_id: ligaId,
    pontos_pagos: custo,
    fichas_total: FICHAS_POR_LIGA,
    created_at: now(),
  };

  return {
    ...db,
    users: db.users.map((u) => (u.id === userId ? { ...u, saldo_pontos: u.saldo_pontos - custo } : u)),
    entradas: [...db.entradas, entrada],
  };
}

/** Distribui FICHAS nos mercados. Cria 1 registro em `apostas` por mercado. Não toca em PONTOS. */
export function apostar(db: DB, userId: string, ligaId: string, distribuicao: Record<string, number>): DB {
  const liga = getLiga(db, ligaId);
  if (liga.status !== 'aberta') throw new RuleError('Apostas encerradas para esse palpite.');
  if (!getEntrada(db, userId, ligaId)) throw new RuleError('Entre no palpite antes de distribuir fichas.');

  const itens = Object.entries(distribuicao).filter(([, f]) => f > 0);
  if (itens.length === 0) throw new RuleError('Distribua pelo menos 1 ficha.');

  for (const [mercadoId, fichas] of itens) {
    if (!Number.isInteger(fichas)) throw new RuleError('Use apenas números inteiros de fichas.');
    const mercado = db.mercados.find((m) => m.id === mercadoId);
    if (!mercado || mercado.liga_id !== ligaId) throw new RuleError('Mercado inválido para esse palpite.');
  }

  const total = itens.reduce((s, [, f]) => s + f, 0);
  const disponiveis = fichasDisponiveis(db, userId, ligaId);
  if (total > disponiveis) {
    throw new RuleError(`Você tem ${disponiveis} fichas livres e tentou distribuir ${total}.`);
  }

  const novas = itens.map(([mercado_id, fichas_apostadas]) => ({
    id: uid('a'),
    user_id: userId,
    liga_id: ligaId,
    mercado_id,
    fichas_apostadas,
    created_at: now(),
  }));

  return { ...db, apostas: [...db.apostas, ...novas] };
}

export function pontuacaoUsuario(db: DB, userId: string, ligaId: string): number {
  const vencedores = new Map(
    db.mercados.filter((m) => m.liga_id === ligaId && m.resultado_final).map((m) => [m.id, m.multiplicador]),
  );
  const total = db.apostas
    .filter((a) => a.user_id === userId && a.liga_id === ligaId && vencedores.has(a.mercado_id))
    .reduce((sum, a) => sum + a.fichas_apostadas * (vencedores.get(a.mercado_id) ?? 0), 0);
  return round2(total);
}

/** Ordena por pontuação (desc); empate: quem entrou primeiro na liga. */
export function calcularRanking(db: DB, ligaId: string): RankingRow[] {
  const entradas = db.entradas
    .filter((e) => e.liga_id === ligaId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const rows = entradas
    .map((e) => ({
      user: db.users.find((u) => u.id === e.user_id),
      pontuacao: pontuacaoUsuario(db, e.user_id, ligaId),
      fichas_apostadas: fichasUsadas(db, e.user_id, ligaId),
    }))
    .filter((r): r is Omit<RankingRow, 'posicao'> => !!r.user);

  return rows
    .map((r, i) => ({ ...r, ordem: i }))
    .sort((a, b) => b.pontuacao - a.pontuacao || a.ordem - b.ordem)
    .map(({ ordem: _ordem, ...r }, i) => ({ ...r, posicao: i + 1 }));
}

function gerarCodigoVoucher() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `PT-${s}`;
}

/**
 * Regra de retorno: ao finalizar, o 1º lugar recebe saldo_pontos += custo_entrada e ganha um voucher.
 * Demais perdem os PONTOS da entrada. Se ninguém pontuou, não há vencedor.
 */
export function finalizarLiga(
  db: DB,
  ligaId: string,
  mercadosVencedores: string[],
): { db: DB; ranking: RankingRow[]; voucher: Voucher | null } {
  const liga = getLiga(db, ligaId);
  if (liga.status === 'finalizada') throw new RuleError('Palpite já finalizado.');

  const vencedores = new Set(mercadosVencedores);
  let next: DB = {
    ...db,
    ligas: db.ligas.map((l) => (l.id === ligaId ? { ...l, status: 'finalizada' } : l)),
    mercados: db.mercados.map((m) => (m.liga_id === ligaId ? { ...m, resultado_final: vencedores.has(m.id) } : m)),
  };

  const ranking = calcularRanking(next, ligaId);
  const primeiro = ranking[0];
  if (!primeiro || primeiro.pontuacao <= 0) return { db: next, ranking, voucher: null };

  const voucher: Voucher = {
    id: uid('v'),
    user_id: primeiro.user.id,
    liga_id: ligaId,
    codigo: gerarCodigoVoucher(),
    premio_desc: liga.premio_desc,
    pontos_devolvidos: liga.custo_entrada,
    created_at: now(),
  };

  next = {
    ...next,
    users: next.users.map((u) =>
      u.id === primeiro.user.id ? { ...u, saldo_pontos: u.saldo_pontos + liga.custo_entrada } : u,
    ),
    vouchers: [...next.vouchers, voucher],
  };

  return { db: next, ranking: calcularRanking(next, ligaId), voucher };
}

/** Premium não vê anúncios. Com bairro_alvo, só aparece para quem é do mesmo bairro. */
export function anunciosElegiveis(db: DB, tipo: AnuncioTipo, user: User | null | undefined): Anuncio[] {
  if (!user || user.is_premium) return [];
  return db.anuncios.filter(
    (a) =>
      a.tipo === tipo &&
      a.status === 'ativo' &&
      (a.bairro_alvo == null || normalize(a.bairro_alvo) === normalize(user.bairro)),
  );
}

export function sortear<T>(lista: T[], rand: () => number = Math.random): T | null {
  if (lista.length === 0) return null;
  return lista[Math.floor(rand() * lista.length)] ?? null;
}
