/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMockDB } from '../data/mock';
import {
  anunciosElegiveis,
  apostar,
  calcularRanking,
  criarUsuario,
  entrarNaLiga,
  fichasDisponiveis,
  finalizarLiga,
  RuleError,
} from './rules';

const novoUsuario = (bairro = 'Aldeota') => {
  const { db, user } = criarUsuario(createMockDB(), { name: 'Vitória', whatsapp: '(85) 99999-0000', bairro });
  return { db, userId: user.id };
};
const saldo = (db: ReturnType<typeof createMockDB>, id: string) => db.users.find((u) => u.id === id)!.saldo_pontos;

test('onboarding cria usuário com 500 PONTOS', () => {
  const { db, userId } = novoUsuario();
  assert.equal(saldo(db, userId), 500);
});

test('entrar na liga debita 100 PONTOS e libera 200 FICHAS', () => {
  let { db, userId } = novoUsuario();
  db = entrarNaLiga(db, userId, 'l_classico');
  assert.equal(saldo(db, userId), 400);
  assert.equal(fichasDisponiveis(db, userId, 'l_classico'), 200);
  assert.throws(() => entrarNaLiga(db, userId, 'l_classico'), RuleError);
});

test('apostar cria registros com as fichas e não mexe nos PONTOS', () => {
  let { db, userId } = novoUsuario();
  db = entrarNaLiga(db, userId, 'l_classico');
  db = apostar(db, userId, 'l_classico', { m_cl_for: 50, m_cl_emp: 30 });
  const minhas = db.apostas.filter((a) => a.user_id === userId);
  assert.deepEqual(minhas.map((a) => a.fichas_apostadas).sort(), [30, 50]);
  assert.equal(saldo(db, userId), 400);
  assert.equal(fichasDisponiveis(db, userId, 'l_classico'), 120);
  assert.throws(() => apostar(db, userId, 'l_classico', { m_cl_cea: 121 }), /120 fichas livres/);
});

test('não pode passar de 200 fichas, nem apostar sem entrar', () => {
  let { db, userId } = novoUsuario();
  assert.throws(() => apostar(db, userId, 'l_classico', { m_cl_for: 10 }), RuleError);
  db = entrarNaLiga(db, userId, 'l_classico');
  assert.throws(() => apostar(db, userId, 'l_classico', { m_cl_for: 100, m_cl_emp: 101 }), RuleError);
});

test('não entra em liga em andamento/finalizada nem sem saldo', () => {
  let { db, userId } = novoUsuario();
  assert.throws(() => entrarNaLiga(db, userId, 'l_for_bah'), RuleError);
  assert.throws(() => entrarNaLiga(db, userId, 'l_flo_for'), RuleError);
  db = { ...db, users: db.users.map((u) => (u.id === userId ? { ...u, saldo_pontos: 99 } : u)) };
  assert.throws(() => entrarNaLiga(db, userId, 'l_classico'), /Saldo insuficiente/);
});

test('ranking = SUM(fichas * multiplicador) dos mercados com resultado_final', () => {
  const ranking = calcularRanking(createMockDB(), 'l_flo_for');
  assert.equal(ranking[0].user.id, 'u_tico');
  assert.equal(ranking[0].pontuacao, 350); // 120*1.45 + 80*2.2
  assert.equal(ranking[1].pontuacao, 145); // 100*1.45
  assert.equal(ranking.at(-1)!.pontuacao, 0);
});

test('finalizar: 1º lugar recebe custo_entrada de volta + voucher; demais perdem', () => {
  let { db, userId } = novoUsuario();
  db = entrarNaLiga(db, userId, 'l_classico');
  db = apostar(db, userId, 'l_classico', { m_cl_emp: 200 });
  const leaoAntes = saldo(db, 'u_leao');
  const res = finalizarLiga(db, 'l_classico', ['m_cl_emp', 'm_cl_amb']);
  assert.equal(res.ranking[0].user.id, userId);
  assert.equal(res.ranking[0].pontuacao, 640);
  assert.equal(saldo(res.db, userId), 500);
  assert.equal(saldo(res.db, 'u_leao'), leaoAntes);
  assert.equal(res.voucher?.user_id, userId);
  assert.throws(() => finalizarLiga(res.db, 'l_classico', []), RuleError);
});

test('anúncios: filtro por bairro e premium esconde tudo', () => {
  const { db, userId } = novoUsuario('aldeota');
  const user = db.users.find((u) => u.id === userId)!;
  const banners = anunciosElegiveis(db, 'banner', user).map((a) => a.id);
  assert.ok(banners.includes('ad_b_acai'));
  assert.ok(banners.includes('ad_b_farm'));
  assert.ok(!banners.includes('ad_b_pizza'));
  assert.ok(!banners.includes('ad_b_off'));
  assert.deepEqual(anunciosElegiveis(db, 'banner', { ...user, is_premium: true }), []);
  assert.deepEqual(anunciosElegiveis(db, 'interstitial', { ...user, is_premium: true }), []);
  for (const bairro of ['Aldeota', 'Benfica', 'Messejana', 'Meireles']) {
    const ints = anunciosElegiveis(db, 'interstitial', { ...user, bairro }).map((x) => x.id);
    assert.deepEqual(ints, ['ad_i_flores']);
  }
});
