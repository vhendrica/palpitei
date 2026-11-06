import { gerarOtp, gerarToken, sha256 } from './crypto.ts';
import { type Db, iso, num, type Tx } from './db.ts';
import { AuthError, RuleError } from './errors.ts';
import {
  hojeISO,
  parseDataNascimento,
  validarBairro,
  validarCpf,
  validarMaioridade,
  validarNome,
  validarWhatsapp,
} from './validation.ts';
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

export type AuthDeps = { sql: Db; send: WhatsappSender; otp?: Partial<OtpOptions>; hoje?: () => string };

export type UserPublico = {
  id: string;
  nome: string;
  whatsapp: string;
  bairro: string;
  saldo_pontos: number;
  is_admin: boolean;
  created_at: string;
};

export const mapUser = (u: Record<string, unknown>): UserPublico => ({
  id: u.id as string,
  nome: u.nome as string,
  whatsapp: u.whatsapp as string,
  bairro: u.bairro as string,
  saldo_pontos: num(u.saldo_pontos),
  is_admin: !!u.is_admin,
  created_at: iso(u.created_at as Date)!,
});

const opts = (d: AuthDeps): OtpOptions => ({ ...OTP_PADRAO, ...d.otp });

const mascarar = (w: string) => `(${w.slice(0, 2)}) *****-${w.slice(-4)}`;

export type CadastroInput = {
  nome: unknown;
  whatsapp: unknown;
  cpf: unknown;
  data_nascimento: unknown;
  bairro: unknown;
  aceita_termos: unknown;
  aceita_compartilhamento: unknown;
};

/** Cria (ou recria) o cadastro pendente e envia o código. A conta só é ativada em `confirmarCodigo`. */
export async function cadastrar(d: AuthDeps, input: CadastroInput) {
  const nome = validarNome(input.nome);
  const whatsapp = validarWhatsapp(input.whatsapp);
  const cpf = validarCpf(input.cpf);
  const nascimento = parseDataNascimento(input.data_nascimento);
  validarMaioridade(nascimento, (d.hoje ?? hojeISO)());
  const bairro = validarBairro(input.bairro);
  if (input.aceita_termos !== true) throw new RuleError('Você precisa concordar com os Termos de Uso.');
  if (input.aceita_compartilhamento !== true) {
    throw new RuleError('Você precisa concordar com o compartilhamento dos seus dados.');
  }

  await d.sql.begin(async (tx: Tx) => {
    const existentes = await tx`
      select id, whatsapp, cpf, ativado_em from users where whatsapp = ${whatsapp} or cpf = ${cpf} for update`;
    if (existentes.some((u) => u.ativado_em && u.cpf === cpf)) throw new RuleError('CPF já cadastrado.');
    if (existentes.some((u) => u.ativado_em && u.whatsapp === whatsapp)) {
      throw new RuleError('WhatsApp já cadastrado. Entre com seu número.');
    }
    // Cadastros nunca confirmados não seguram CPF/WhatsApp: são substituídos.
    if (existentes.length) await tx`delete from users where id in ${tx(existentes.map((u) => u.id as string))}`;

    await tx`
      insert into users (nome, whatsapp, cpf, data_nascimento, bairro,
                         terms_accepted_at, terms_version, data_consent_accepted_at, data_consent_version)
      select ${nome}, ${whatsapp}, ${cpf}, ${nascimento}, ${bairro},
             clock_timestamp(), c.termos_versao, clock_timestamp(), c.consentimento_versao
      from config c where c.id = 1`;
  });

  return emitirCodigo(d, whatsapp);
}

/** Login (ou reenvio): manda um novo código para um WhatsApp já cadastrado. */
export async function solicitarCodigo(d: AuthDeps, input: { whatsapp: unknown }) {
  const whatsapp = validarWhatsapp(input.whatsapp);
  const [u] = await d.sql`select id from users where whatsapp = ${whatsapp}`;
  if (!u) throw new RuleError('WhatsApp não cadastrado. Faça seu cadastro.');
  return emitirCodigo(d, whatsapp);
}

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
