const enc = new TextEncoder();

export async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomInt(maxExclusive: number) {
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  const a = new Uint32Array(1);
  do crypto.getRandomValues(a);
  while (a[0] >= limit);
  return a[0] % maxExclusive;
}

export const gerarOtp = () => String(randomInt(1_000_000)).padStart(6, '0');

export function gerarToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---- senhas: PBKDF2-HMAC-SHA256 via WebCrypto (OWASP: 600k iterações). ----
// Formato gravado: pbkdf2$<iters>$<salt_b64>$<hash_b64> — salt aleatório de 16B por usuário.

const SENHA_ITERS = 600_000;

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(senha: string, salt: Uint8Array, iters: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iters },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashSenha(senha: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(senha, salt, SENHA_ITERS);
  return `pbkdf2$${SENHA_ITERS}$${b64(salt)}$${b64(hash)}`;
}

/** Comparação em tempo constante (mesmo número de iterações + XOR acumulado). */
export async function conferirSenha(senha: string, armazenado: string | null | undefined) {
  const partes = (armazenado ?? '').split('$');
  const iters = Number(partes[1]);
  if (partes[0] !== 'pbkdf2' || !Number.isInteger(iters) || partes.length !== 4) return false;
  const esperado = unb64(partes[3]);
  const calculado = await pbkdf2(senha, unb64(partes[2]), iters);
  if (calculado.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < calculado.length; i++) dif |= calculado[i] ^ esperado[i];
  return dif === 0;
}

export function gerarCodigoVoucher() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[randomInt(chars.length)];
  return `PT-${s}`;
}
