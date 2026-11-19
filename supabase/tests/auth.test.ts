import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { type AuthDeps, cadastrar, confirmarCodigo, entrar, solicitarCodigo, usuarioDaSessao } from '../functions/_core/auth.ts';
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
  email: 'Vitoria@Exemplo.com',
  senha: 'senha1234',
  whatsapp: '(85) 99999-0000',
  cpf: '529.982.247-25',
  data_nascimento: '1995-05-10',
  bairro: 'Aldeota',
  aceita_termos: true,
  aceita_compartilhamento: true,
  ...over,
});

test('cadastro por e-mail ativa a conta na hora com os PONTOS de boas-vindas; login por senha', async () => {
  const r = await cadastrar(deps, input());
  assert.equal(r.nova_conta, true);
  assert.equal(r.user.saldo_pontos, 500);
  assert.equal((await usuarioDaSessao(sql, r.token))?.id, r.user.id);
  assert.equal(await usuarioDaSessao(sql, 'token-falso'), null);
  const [u] = await sql`select * from users where id = ${r.user.id}`;
  assert.equal(u.email, 'vitoria@exemplo.com');
  assert.notEqual(u.senha_hash, 'senha1234', 'senha não fica em texto puro');
  assert.ok(u.terms_accepted_at instanceof Date);
  assert.ok(u.data_consent_accepted_at instanceof Date);

  const l = await entrar(deps, { email: 'VITORIA@exemplo.com', senha: 'senha1234' });
  assert.equal(l.nova_conta, false);
  assert.equal(l.user.saldo_pontos, 500);
  await assert.rejects(entrar(deps, { email: 'vitoria@exemplo.com', senha: 'errada123' }), {
    message: 'E-mail ou senha incorretos.',
  });
});

test('rejeita menor de 18, CPF inválido, senha fraca e consentimentos ausentes', async () => {
  await assert.rejects(cadastrar(deps, input({ data_nascimento: '2008-10-30' })), {
    message: 'Cadastro permitido somente para maiores de 18 anos.',
  });
  await assert.doesNotReject(cadastrar(deps, input({ data_nascimento: '2008-10-29' })));
  await assert.rejects(cadastrar(deps, input({ cpf: '529.982.247-24' })), { message: 'CPF inválido.' });
  await assert.rejects(cadastrar(deps, input({ senha: 'curta1' })), {
    message: 'A senha precisa ter no mínimo 8 caracteres.',
  });
  await assert.rejects(cadastrar(deps, input({ aceita_termos: false })), {
    message: 'Você precisa concordar com os Termos de Uso.',
  });
  await assert.rejects(cadastrar(deps, input({ aceita_compartilhamento: 'true' })), {
    message: 'Você precisa concordar com o compartilhamento dos seus dados.',
  });
});

test('CPF, e-mail e WhatsApp únicos entre contas ativas', async () => {
  await cadastrar(deps, input());
  await assert.rejects(cadastrar(deps, input({ email: 'b@exemplo.com', whatsapp: '(85) 99999-0101' })), { message: 'CPF já cadastrado.' });
  await assert.rejects(cadastrar(deps, input({ cpf: '111.444.777-35', whatsapp: '(85) 99999-0102' })), {
    message: 'E-mail já cadastrado. Faça login.',
  });
  await assert.rejects(cadastrar(deps, input({ cpf: '111.444.777-35', email: 'b@exemplo.com' })), {
    message: 'WhatsApp já cadastrado.',
  });
});

test('login trava após erros seguidos de senha', async () => {
  await cadastrar(deps, input());
  for (let i = 0; i < 8; i++) {
    await assert.rejects(entrar(deps, { email: 'vitoria@exemplo.com', senha: 'errada123' }));
  }
  await assert.rejects(entrar(deps, { email: 'vitoria@exemplo.com', senha: 'senha1234' }), {
    message: 'Muitas tentativas. Tente novamente em alguns minutos.',
  });
});

test('OTP: incorreto conta tentativa, bloqueia após 5, expira e só vale o último', async () => {
  await cadastrar(deps, input());
  const w = '85999990000';
  await solicitarCodigo(deps, { whatsapp: w });
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
  await solicitarCodigo(d, { whatsapp: '85999990000' });
  await assert.rejects(solicitarCodigo(d, { whatsapp: '85999990000' }), {
    message: 'Aguarde um minuto para pedir um novo código.',
  });
  await assert.rejects(solicitarCodigo(d, { whatsapp: '85911112222' }), {
    message: 'WhatsApp não cadastrado. Faça seu cadastro.',
  });
});

test('falha no envio do WhatsApp invalida o código e avisa o usuário', async () => {
  await cadastrar(deps, input());
  const d = { ...deps, send: async () => Promise.reject(new Error('down')) };
  await assert.rejects(solicitarCodigo(d, { whatsapp: '85999990000' }), {
    message: 'Não conseguimos enviar o código pelo WhatsApp. Tente novamente.',
  });
  assert.equal((await sql`select count(*)::int as n from otp_codes where not usado`)[0].n, 0);
});
