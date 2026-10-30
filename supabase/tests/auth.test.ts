import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { type AuthDeps, cadastrar, confirmarCodigo, solicitarCodigo, usuarioDaSessao } from '../functions/_core/auth.ts';
import { limpar, setupDb, type Sql } from './helpers.ts';

let sql: Sql;
let enviados: { whatsapp: string; codigo: string }[];
let deps: AuthDeps;

before(async () => (sql = await setupDb()));
after(async () => sql.end());
beforeEach(async () => {
  await limpar(sql);
  enviados = [];
  deps = {
    sql,
    send: async (whatsapp, codigo) => void enviados.push({ whatsapp, codigo }),
    otp: { reenvioMs: 0 },
    hoje: () => '2026-10-29',
  };
});

const input = (over: Record<string, unknown> = {}) => ({
  nome: 'Vitória Hendrica',
  whatsapp: '(85) 99999-0000',
  cpf: '529.982.247-25',
  data_nascimento: '1995-05-10',
  bairro: 'Aldeota',
  aceita_termos: true,
  aceita_compartilhamento: true,
  ...over,
});

test('cadastro → código no WhatsApp → confirmação ativa a conta com 500 PONTOS', async () => {
  const r = await cadastrar(deps, input());
  assert.equal(r.whatsapp, '85999990000');
  assert.equal(r.destino, '(85) *****-0000');
  assert.equal(enviados.length, 1);
  assert.match(enviados[0].codigo, /^\d{6}$/);

  const [pendente] = await sql`select * from users where whatsapp = '85999990000'`;
  assert.equal(pendente.ativado_em, null);
  assert.equal(pendente.saldo_pontos, 0);
  assert.ok(pendente.terms_accepted_at instanceof Date);
  assert.ok(pendente.data_consent_accepted_at instanceof Date);
  assert.equal(pendente.terms_version, '2026-10-v1');
  assert.equal(pendente.data_consent_version, '2026-10-v1');
  const [otp] = await sql`select codigo from otp_codes`;
  assert.notEqual(otp.codigo, enviados[0].codigo, 'código não fica em texto puro');

  const c = await confirmarCodigo(deps, { whatsapp: '85999990000', codigo: enviados[0].codigo });
  assert.equal(c.nova_conta, true);
  assert.equal(c.user.saldo_pontos, 500);
  assert.equal((await usuarioDaSessao(sql, c.token))?.id, c.user.id);
  assert.equal(await usuarioDaSessao(sql, 'token-falso'), null);

  // Login depois: novo código, sem novo bônus.
  await solicitarCodigo(deps, { whatsapp: '85999990000' });
  const l = await confirmarCodigo(deps, { whatsapp: '85999990000', codigo: enviados[1].codigo });
  assert.equal(l.nova_conta, false);
  assert.equal(l.user.saldo_pontos, 500);
});

test('rejeita menor de 18, CPF inválido e consentimentos ausentes', async () => {
  await assert.rejects(cadastrar(deps, input({ data_nascimento: '2008-10-30' })), {
    message: 'Cadastro permitido somente para maiores de 18 anos.',
  });
  await assert.doesNotReject(cadastrar(deps, input({ data_nascimento: '2008-10-29' })));
  await assert.rejects(cadastrar(deps, input({ cpf: '529.982.247-24' })), { message: 'CPF inválido.' });
  await assert.rejects(cadastrar(deps, input({ aceita_termos: false })), {
    message: 'Você precisa concordar com os Termos de Uso.',
  });
  await assert.rejects(cadastrar(deps, input({ aceita_compartilhamento: 'true' })), {
    message: 'Você precisa concordar com o compartilhamento dos seus dados.',
  });
});

test('CPF e WhatsApp únicos entre contas ativas; cadastro pendente é substituído', async () => {
  await cadastrar(deps, input());
  await cadastrar(deps, input({ nome: 'Outra Pessoa' }));
  assert.equal((await sql`select count(*)::int as n from users`)[0].n, 1);
  await confirmarCodigo(deps, { whatsapp: '85999990000', codigo: enviados.at(-1)!.codigo });

  await assert.rejects(cadastrar(deps, input({ whatsapp: '85988887777' })), { message: 'CPF já cadastrado.' });
  await assert.rejects(cadastrar(deps, input({ cpf: '111.444.777-35' })), {
    message: 'WhatsApp já cadastrado. Entre com seu número.',
  });
});

test('OTP: incorreto conta tentativa, bloqueia após 5, expira e só vale o último', async () => {
  await cadastrar(deps, input());
  const w = '85999990000';
  const certo = enviados[0].codigo;
  const errado = certo === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) {
    await assert.rejects(confirmarCodigo(deps, { whatsapp: w, codigo: errado }), { message: 'Código incorreto.' });
  }
  await assert.rejects(confirmarCodigo(deps, { whatsapp: w, codigo: certo }), {
    message: 'Muitas tentativas. Peça um novo código.',
  });

  await solicitarCodigo(deps, { whatsapp: w });
  await solicitarCodigo(deps, { whatsapp: w });
  await assert.rejects(confirmarCodigo(deps, { whatsapp: w, codigo: enviados[1].codigo === enviados[2].codigo ? 'x' : enviados[1].codigo }));

  await sql`update otp_codes set expires_at = now() - interval '1 second' where not usado`;
  await assert.rejects(confirmarCodigo(deps, { whatsapp: w, codigo: enviados[2].codigo }), {
    message: 'Código expirado. Peça um novo.',
  });
});

test('reenvio limitado a 1 por minuto e login exige cadastro', async () => {
  const d = { ...deps, otp: {} };
  await cadastrar(d, input());
  await assert.rejects(solicitarCodigo(d, { whatsapp: '85999990000' }), {
    message: 'Aguarde um minuto para pedir um novo código.',
  });
  await assert.rejects(solicitarCodigo(d, { whatsapp: '85911112222' }), {
    message: 'WhatsApp não cadastrado. Faça seu cadastro.',
  });
});

test('falha no envio do WhatsApp invalida o código e avisa o usuário', async () => {
  const d = { ...deps, send: async () => Promise.reject(new Error('down')) };
  await assert.rejects(cadastrar(d, input()), {
    message: 'Não conseguimos enviar o código pelo WhatsApp. Tente novamente.',
  });
  assert.equal((await sql`select count(*)::int as n from otp_codes where not usado`)[0].n, 0);
});
