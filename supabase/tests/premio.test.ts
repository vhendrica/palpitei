import assert from 'node:assert/strict';
import { test } from 'node:test';

import { progressoPremio, resolverPremio, validarEscada } from '../functions/_core/premio.ts';

const escada = [
  { ordem: 1, usuarios_min: 100, valor: 100 },
  { ordem: 2, usuarios_min: 250, valor: 300 },
  { ordem: 3, usuarios_min: 500, valor: 500 },
];

test('resolverPremio: faixa atingida, 0 abaixo da 1ª, teto na meta', () => {
  assert.equal(resolverPremio(escada, 0), 0);
  assert.equal(resolverPremio(escada, 99), 0);
  assert.equal(resolverPremio(escada, 100), 100);
  assert.equal(resolverPremio(escada, 499), 300);
  assert.equal(resolverPremio(escada, 500), 500);
  assert.equal(resolverPremio(escada, 5000), 500);
  assert.equal(resolverPremio([], 1000), 0);
});

test('progressoPremio: quantos faltam e meta atingida', () => {
  const p = progressoPremio(escada, 180);
  assert.equal(p.premio_atual, 100);
  assert.deepEqual(p.proxima, { usuarios_min: 250, valor: 300, faltam: 70 });
  assert.equal(p.faltam_meta, 320);
  assert.equal(p.meta_atingida, false);

  const m = progressoPremio(escada, 612);
  assert.equal(m.meta_atingida, true);
  assert.equal(m.premio_atual, 500);
  assert.equal(m.proxima, null);
  assert.equal(m.faltam_meta, 0);
});

test('progressoPremio usa premio_final gravado quando a liga já foi finalizada', () => {
  assert.equal(progressoPremio(escada, 900, 300).premio_atual, 300);
});

test('validarEscada exige faixas crescentes', () => {
  assert.equal(validarEscada([{ usuarios_min: 100, valor: 100 }, { usuarios_min: 250, valor: 300 }]), null);
  assert.ok(validarEscada([]));
  assert.ok(validarEscada([{ usuarios_min: 250, valor: 100 }, { usuarios_min: 100, valor: 300 }]));
});
