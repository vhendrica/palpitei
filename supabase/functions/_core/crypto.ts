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

export function gerarCodigoVoucher() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[randomInt(chars.length)];
  return `PT-${s}`;
}
