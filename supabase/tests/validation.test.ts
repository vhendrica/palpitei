import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RuleError } from '../functions/_core/errors.ts';
import {
  idadeEm,
  nomePublico,
  parseDataNascimento,
  validarCpf,
  validarMaioridade,
  validarWhatsapp,
} from '../functions/_core/validation.ts';

test('CPF: aceita válido (com ou sem máscara) e rejeita dígito errado/repetido', () => {
  assert.equal(validarCpf('529.982.247-25'), '52998224725');
  assert.equal(validarCpf('11144477735'), '11144477735');
  assert.throws(() => validarCpf('529.982.247-24'), RuleError);
  assert.throws(() => validarCpf('111.111.111-11'), RuleError);
  assert.throws(() => validarCpf('123'), RuleError);
});

test('WhatsApp: DDD + número, aceita +55', () => {
  assert.equal(validarWhatsapp('(85) 99999-0000'), '85999990000');
  assert.equal(validarWhatsapp('+55 85 99999-0000'), '85999990000');
  assert.throws(() => validarWhatsapp('99999'), /WhatsApp inválido/);
});

test('data de nascimento: formatos e datas impossíveis', () => {
  assert.equal(parseDataNascimento('2000-02-29'), '2000-02-29');
  assert.equal(parseDataNascimento('31/12/1999'), '1999-12-31');
  assert.throws(() => parseDataNascimento('2001-02-29'), RuleError);
  assert.throws(() => parseDataNascimento('ontem'), RuleError);
});

test('maioridade: 18 anos completos no dia', () => {
  assert.equal(idadeEm('2008-10-30', '2026-10-29'), 17);
  assert.equal(idadeEm('2008-10-29', '2026-10-29'), 18);
  assert.doesNotThrow(() => validarMaioridade('2008-10-29', '2026-10-29'));
  assert.throws(() => validarMaioridade('2008-10-30', '2026-10-29'), /maiores de 18/);
  assert.throws(() => validarMaioridade('2030-01-01', '2026-10-29'), /inválida/);
});

test('nome público no ranking', () => {
  assert.equal(nomePublico('Vitória Hendrica Souza'), 'Vitória S.');
  assert.equal(nomePublico('Vitória'), 'Vitória');
});
