import { conferirSenha, gerarOtp, gerarToken, hashSenha, sha256 } from './crypto.ts';
import { type Db, iso, num, type Tx } from './db.ts';
import { AuthError, RuleError } from './errors.ts';
import {
  hojeISO,
  parseDataNascimento,
  validarBairro,
  validarCpf,
  validarEmail,
  validarMaioridade,
  validarNome,
  validarSenha,
  validarWhatsapp,
} from './validation.ts';
import type { EmailSender } from './email.ts';
import type { WhatsappSender } from './whatsapp.ts';

export type OtpOptions = {
  ttlMs: number;
  reenvioMs: number;
  maxTentativas: number;
  sessaoDias: number;
  /** Em modo mock devolve o código na resposta, para facilitar o desenvolvimento. */
  expor: boolean;
};

export const OTP_PADRAO: OtpOptions = {
  ttlMs: 10 * 60_000,
  reenvioMs: 60_000,
  maxTentativas: 5,
  sessaoDias: 30,
  expor: false,
};

export type AuthDeps = {
  sql: Db;
  send: WhatsappSender;
  otp?: Partial<OtpOptions>;
  hoje?: () => string;
  /** Recuperação de senha: envio do e-mail e endereço do app (pro link). */
  email?: EmailSender;
  appUrl?: string;
};

export type UserPublico = {
  id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  bairro: string;
  saldo_pontos: number;
  is_admin: boolean;
  login_streak?: number;
  maior_streak?: number;
  created_at: string;
};

export const mapUser = (u: Record<string, unknown>): UserPublico => ({
  id: u.id as string,
  nome: u.nome as string,
  whatsapp: (u.whatsapp as string | null) ?? null,
  email: (u.email as string | null) ?? null,
  bairro: u.bairro as string,
  saldo_pontos: num(u.saldo_pontos),
  is_admin: !!u.is_admin,
  login_streak: u.login_streak == null ? undefined : num(u.login_streak),
  maior_streak: u.maior_streak == null ? undefined : num(u.maior_streak),
  created_at: iso(u.created_at as Date)!,
});

const opts = (d: AuthDeps): OtpOptions => ({ ...OTP_PADRAO, ...d.otp });

const mascarar = (w: string) => `(${w.slice(0, 2)}) *****-${w.slice(-4)}`;

export type CadastroInput = {
  nome: unknown;
  email: unknown;
  senha: unknown;
  whatsapp: unknown;
  cpf: unknown;
  data_nascimento: unknown;
  bairro: unknown;
  aceita_termos: unknown;
  aceita_compartilhamento: unknown;
};

const criarSessao = async (tx: Tx, userId: string, sessaoDias: number) => {
  const token = gerarToken();
  const tokenHash = await sha256(token);
  await tx`
    insert into sessions (token_hash, user_id, expires_at)
    values (${tokenHash}, ${userId}, now() + make_interval(days => ${sessaoDias}))`;
  return token;
};

/** Cadastro por e-mail + senha: ativa a conta na hora, credita boas-vindas e devolve a sessão. */
export async function cadastrar(d: AuthDeps, input: CadastroInput) {
  const nome = validarNome(input.nome);
  const email = validarEmail(input.email);
  const senha = validarSenha(input.senha);
  const whatsapp = validarWhatsapp(input.whatsapp);
  const cpf = validarCpf(input.cpf);
  const nascimento = parseDataNascimento(input.data_nascimento);
  validarMaioridade(nascimento, (d.hoje ?? hojeISO)());
  const bairro = validarBairro(input.bairro);
  if (input.aceita_termos !== true) throw new RuleError('Você precisa concordar com os Termos de Uso.');
  if (input.aceita_compartilhamento !== true) {
    throw new RuleError('Você precisa concordar com o compartilhamento dos seus dados.');
  }
  const senhaHash = await hashSenha(senha);
  const o = opts(d);

  const res = await d.sql.begin(async (tx: Tx) => {
    const existentes = await tx`
      select id, cpf, whatsapp, email, ativado_em from users
      where cpf = ${cpf}
         or lower(email) = ${email}
         ${whatsapp ? tx`or whatsapp = ${whatsapp}` : tx``}
      for update`;
    if (existentes.some((u) => u.ativado_em && u.cpf === cpf)) throw new RuleError('CPF já cadastrado.');
    if (existentes.some((u) => u.ativado_em && String(u.email ?? '').toLowerCase() === email)) {
      throw new RuleError('E-mail já cadastrado. Faça login.');
    }
    if (whatsapp && existentes.some((u) => u.ativado_em && u.whatsapp === whatsapp)) {
      throw new RuleError('WhatsApp já cadastrado.');
    }
    // Cadastros nunca ativados não seguram CPF/e-mail/WhatsApp: são substituídos.
    const pendentes = existentes.filter((u) => !u.ativado_em).map((u) => u.id as string);
    if (pendentes.length) await tx`delete from users where id in ${tx(pendentes)}`;

    const [u] = await tx`
      insert into users (nome, email, senha_hash, whatsapp, cpf, data_nascimento, bairro,
                         ativado_em,
                         terms_accepted_at, terms_version, data_consent_accepted_at, data_consent_version)
      select ${nome}, ${email}, ${senhaHash}, ${whatsapp}, ${cpf}, ${nascimento}, ${bairro},
             clock_timestamp(),
             clock_timestamp(), c.termos_versao, clock_timestamp(), c.consentimento_versao
      from config c where c.id = 1
      returning *`;
    await tx`
      update users set saldo_pontos = saldo_pontos + (select pontos_boas_vindas from config where id = 1)
      where id = ${u.id}`;
    const token = await criarSessao(tx, u.id as string, o.sessaoDias);
    const [user] = await tx`select * from users where id = ${u.id}`;
    return { token, user: mapUser(user) };
  });

  return { ...res, nova_conta: true };
}

const LOGIN_MAX_ERROS = 8;
const LOGIN_BLOQUEIO_MIN = 15;

/** Login por e-mail + senha com bloqueio temporário após erros seguidos. */
export async function entrar(d: AuthDeps, input: { email: unknown; senha: unknown }) {
  const email = validarEmail(input.email);
  const senha = String(input.senha ?? '');
  const o = opts(d);
  const generica = 'E-mail ou senha incorretos.';

  const res = await d.sql.begin(async (tx: Tx) => {
    const [u] = await tx`select * from users where lower(email) = ${email} and ativado_em is not null for update`;
    if (!u || !u.senha_hash) return { erro: generica } as const;
    if (u.bloqueado_ate && new Date(u.bloqueado_ate as string) > new Date()) {
      return { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' } as const;
    }
    if (!(await conferirSenha(senha, u.senha_hash as string))) {
      const erros = num(u.senha_erros) + 1;
      await tx`
        update users set senha_erros = ${erros},
               bloqueado_ate = case when ${erros} >= ${LOGIN_MAX_ERROS}
                                    then now() + make_interval(mins => ${LOGIN_BLOQUEIO_MIN})
                                    else bloqueado_ate end
        where id = ${u.id}`;
      return { erro: generica } as const;
    }
    await tx`update users set senha_erros = 0, bloqueado_ate = null where id = ${u.id}`;
    const token = await criarSessao(tx, u.id as string, o.sessaoDias);
    return { token, user: mapUser(u) };
  });

  if ('erro' in res) throw new RuleError(res.erro as string);
  return { ...res, nova_conta: false };
}

/** Login (ou reenvio): manda um novo código para um WhatsApp já cadastrado. */
export async function solicitarCodigo(d: AuthDeps, input: { whatsapp: unknown }) {
  const whatsapp = validarWhatsapp(input.whatsapp);
  const [u] = await d.sql`select id from users where whatsapp = ${whatsapp}`;
  if (!u) throw new RuleError('WhatsApp não cadastrado. Faça seu cadastro.');
  return emitirCodigo(d, whatsapp);
}

const OTP_GLOBAL_POR_MINUTO = 30;

async function emitirCodigo(d: AuthDeps, whatsapp: string) {
  const o = opts(d);
  const codigo = gerarOtp();
  const hash = await sha256(`${whatsapp}:${codigo}`);
  const expiresAt = await d.sql.begin(async (tx: Tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${'otp:' + whatsapp}))`;
    const [ultimo] = await tx`
      select created_at from otp_codes
      where whatsapp = ${whatsapp} and created_at > clock_timestamp() - make_interval(secs => ${o.reenvioMs / 1000})
      order by created_at desc limit 1`;
    if (ultimo) throw new RuleError('Aguarde um minuto para pedir um novo código.');
    // Teto global contra disparo em massa pra números diferentes (custo no provedor).
    await tx`select pg_advisory_xact_lock(hashtext('otp:global'))`;
    const [{ n }] = await tx`select count(*)::int as n from otp_codes where created_at > clock_timestamp() - interval '1 minute'`;
    if (n >= OTP_GLOBAL_POR_MINUTO) throw new RuleError('Muitos pedidos de código agora. Tente de novo em instantes.');
    await tx`update otp_codes set usado = true where whatsapp = ${whatsapp} and not usado`;
    const [r] = await tx`
      insert into otp_codes (whatsapp, codigo, expires_at)
      values (${whatsapp}, ${hash}, clock_timestamp() + make_interval(secs => ${o.ttlMs / 1000}))
      returning expires_at`;
    return iso(r.expires_at)!;
  });

  try {
    await d.send(whatsapp, codigo);
  } catch (e) {
    console.error('[otp] falha no envio', e);
    await d.sql`update otp_codes set usado = true where whatsapp = ${whatsapp} and codigo = ${hash}`;
    throw new RuleError('Não conseguimos enviar o código pelo WhatsApp. Tente novamente.');
  }

  return {
    whatsapp,
    destino: mascarar(whatsapp),
    expires_at: expiresAt,
    ...(o.expor ? { dev_codigo: codigo } : {}),
  };
}

/** Confere o código; na 1ª confirmação ativa a conta e credita os PONTOS de boas-vindas. Devolve o token. */
export async function confirmarCodigo(d: AuthDeps, input: { whatsapp: unknown; codigo: unknown }) {
  const o = opts(d);
  const whatsapp = validarWhatsapp(input.whatsapp);
  const codigo = String(input.codigo ?? '').replace(/\D/g, '');
  if (codigo.length !== 6) throw new RuleError('Código inválido.');
  const hash = await sha256(`${whatsapp}:${codigo}`);
  const token = gerarToken();
  const tokenHash = await sha256(token);

  const res = await d.sql.begin(async (tx: Tx) => {
    const [otp] = await tx`
      select id, codigo, tentativas, expires_at <= clock_timestamp() as expirado
      from otp_codes where whatsapp = ${whatsapp} and not usado
      order by created_at desc limit 1 for update`;
    if (!otp || otp.expirado) return { erro: 'Código expirado. Peça um novo.' } as const;
    if (num(otp.tentativas) >= o.maxTentativas) return { erro: 'Muitas tentativas. Peça um novo código.' } as const;
    if (otp.codigo !== hash) {
      await tx`update otp_codes set tentativas = tentativas + 1 where id = ${otp.id}`;
      return { erro: 'Código incorreto.' } as const;
    }
    await tx`update otp_codes set usado = true where id = ${otp.id}`;

    const [u] = await tx`select id, ativado_em from users where whatsapp = ${whatsapp} for update`;
    if (!u) return { erro: 'WhatsApp não cadastrado. Faça seu cadastro.' } as const;
    const novaConta = !u.ativado_em;
    if (novaConta) {
      await tx`
        update users set ativado_em = clock_timestamp(),
               saldo_pontos = saldo_pontos + (select pontos_boas_vindas from config where id = 1)
        where id = ${u.id}`;
    }
    await tx`
      insert into sessions (token_hash, user_id, expires_at)
      values (${tokenHash}, ${u.id}, now() + make_interval(days => ${o.sessaoDias}))`;
    const [user] = await tx`select * from users where id = ${u.id}`;
    return { user: mapUser(user), novaConta };
  });

  if ('erro' in res) throw new RuleError(res.erro as string);
  return { token, user: res.user, nova_conta: res.novaConta };
}

/** O usuário edita o próprio nome e bairro (WhatsApp e CPF não mudam por aqui). */
export async function atualizarPerfil(sql: Db, user: UserPublico, input: { nome?: unknown; bairro?: unknown }) {
  const nome = validarNome(input.nome);
  const bairro = validarBairro(input.bairro);
  const [u] = await sql`update users set nome = ${nome}, bairro = ${bairro} where id = ${user.id} returning *`;
  return { user: mapUser(u) };
}

export async function usuarioDaSessao(sql: Db, token: string | null | undefined) {
  if (!token) return null;
  const [u] = await sql`
    select u.* from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${await sha256(token)} and s.expires_at > now() and u.ativado_em is not null`;
  return u ? mapUser(u) : null;
}

export async function exigirUsuario(sql: Db, token: string | null | undefined) {
  const u = await usuarioDaSessao(sql, token);
  if (!u) throw new AuthError('Faça login para continuar.');
  return u;
}

export async function sair(sql: Db, token: string) {
  await sql`delete from sessions where token_hash = ${await sha256(token)}`;
}

const RESET_MIN = 30;

/** Pede o link de nova senha. Responde igual exista ou não a conta (não revela e-mails cadastrados). */
export async function pedirRecuperacao(d: AuthDeps, input: { email: unknown }) {
  const email = validarEmail(input.email);
  const ok = { ok: true as const, mensagem: 'Se o e-mail estiver cadastrado, enviamos um link pra criar uma senha nova.' };
  const [u] = await d.sql`select id, nome from users where lower(email) = ${email} and ativado_em is not null`;
  if (!u) return ok;
  const token = gerarToken();
  const criado = await d.sql.begin(async (tx: Tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${'reset:' + u.id}))`;
    const [recente] = await tx`
      select 1 from senha_resets where user_id = ${u.id} and created_at > now() - interval '1 minute'`;
    if (recente) return false;
    await tx`update senha_resets set usado = true where user_id = ${u.id} and not usado`;
    await tx`
      insert into senha_resets (token_hash, user_id, expires_at)
      values (${await sha256(token)}, ${u.id}, now() + make_interval(mins => ${RESET_MIN}))`;
    return true;
  });
  if (!criado) return ok;
  const esc = (t: string) =>
    t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const base = (d.appUrl ?? 'https://vhendrica.github.io/palpitei/app').replace(/\/$/, '');
  const link = `${base}/nova-senha?token=${token}`;
  try {
    await d.email?.(
      email,
      'PALPIT: crie sua senha nova',
      `<p>Oi, ${esc(String(u.nome).split(' ')[0])}!</p><p>Pra criar uma senha nova, toque no link abaixo. Ele vale por ${RESET_MIN} minutos.</p><p><a href="${link}">Criar senha nova</a></p><p>Se não foi você, é só ignorar este e-mail.</p>`,
    );
  } catch (e) {
    console.error('[reset] falha no envio', e);
    // Sem envio, o link novo não vale e não bloqueia um novo pedido.
    await d.sql`delete from senha_resets where token_hash = ${await sha256(token)}`;
  }
  return ok;
}

/** Troca a senha com o token do link; derruba as sessões abertas. */
export async function redefinirSenha(d: AuthDeps, input: { token: unknown; senha: unknown }) {
  const token = String(input.token ?? '');
  const senha = validarSenha(input.senha);
  if (token.length < 20) throw new RuleError('Link inválido. Peça um novo.');
  const hash = await sha256(token);
  const erroLink = 'Link expirado ou já usado. Peça um novo.';
  // Confere o link antes do hash da senha (que é caro).
  const [valido] = await d.sql`
    select 1 from senha_resets where token_hash = ${hash} and not usado and expires_at > now()`;
  if (!valido) throw new RuleError(erroLink);
  const senhaHash = await hashSenha(senha);
  const res = await d.sql.begin(async (tx: Tx) => {
    const [r] = await tx`
      select user_id, usado, expires_at <= now() as expirado from senha_resets where token_hash = ${hash} for update`;
    if (!r || r.usado || r.expirado) return { erro: erroLink } as const;
    await tx`update senha_resets set usado = true where token_hash = ${hash}`;
    await tx`update users set senha_hash = ${senhaHash}, senha_erros = 0, bloqueado_ate = null where id = ${r.user_id}`;
    await tx`delete from sessions where user_id = ${r.user_id}`;
    return { ok: true as const };
  });
  if ('erro' in res) throw new RuleError(res.erro as string);
  return res;
}
