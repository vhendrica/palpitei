import { RuleError } from './errors.ts';

export const TZ = 'America/Fortaleza';
export const IDADE_MINIMA = 18;

export const soDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');

/** Data de hoje (YYYY-MM-DD) no fuso de Fortaleza. */
export function hojeISO(agora = new Date()) {
  return agora.toLocaleDateString('en-CA', { timeZone: TZ });
}

export function validarCpf(raw: unknown): string {
  const cpf = soDigitos(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) throw new RuleError('CPF inválido.');
  const dv = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  if (dv(9) !== Number(cpf[9]) || dv(10) !== Number(cpf[10])) throw new RuleError('CPF inválido.');
  return cpf;
}

export function validarWhatsapp(raw: unknown): string {
  const w = soDigitos(raw).replace(/^55(?=\d{10,11}$)/, '');
  if (w.length < 10 || w.length > 11 || w.startsWith('0')) {
    throw new RuleError('WhatsApp inválido. Use DDD + número.');
  }
  return w;
}

/** Aceita YYYY-MM-DD ou DD/MM/AAAA. Retorna YYYY-MM-DD. */
export function parseDataNascimento(raw: unknown): string {
  const s = String(raw ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) ?? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) throw new RuleError('Data de nascimento inválida.');
  const [y, mo, d] = s.includes('/') ? [m[3], m[2], m[1]] : [m[1], m[2], m[3]];
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() !== Number(mo) - 1 || dt.getUTCDate() !== Number(d)) {
    throw new RuleError('Data de nascimento inválida.');
  }
  if (Number(y) < 1900) throw new RuleError('Data de nascimento inválida.');
  return `${y}-${mo}-${d}`;
}

export function idadeEm(nascimentoISO: string, hoje = hojeISO()) {
  const [ny, nm, nd] = nascimentoISO.split('-').map(Number);
  const [hy, hm, hd] = hoje.split('-').map(Number);
  return hy - ny - (hm < nm || (hm === nm && hd < nd) ? 1 : 0);
}

export function validarMaioridade(nascimentoISO: string, hoje = hojeISO()) {
  const idade = idadeEm(nascimentoISO, hoje);
  if (idade < 0) throw new RuleError('Data de nascimento inválida.');
  if (idade < IDADE_MINIMA) throw new RuleError('Cadastro permitido somente para maiores de 18 anos.');
}

export function validarNome(raw: unknown) {
  const nome = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (nome.length < 2) throw new RuleError('Informe seu nome.');
  if (nome.length > 120) throw new RuleError('Nome muito longo.');
  return nome;
}

export function validarBairro(raw: unknown) {
  const bairro = String(raw ?? '').trim();
  if (!bairro) throw new RuleError('Escolha seu bairro.');
  return bairro;
}

export function validarDataISO(raw: unknown): string {
  const s = String(raw ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new RuleError('Data inválida.');
  return s;
}

/** Ex.: "Vitória Hendrica Souza" → "Vitória H." (ranking público). */
export function nomePublico(nome: string) {
  const [primeiro, ...resto] = nome.trim().split(/\s+/);
  const ultimo = resto.at(-1);
  return ultimo ? `${primeiro} ${ultimo[0].toUpperCase()}.` : primeiro;
}

export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
