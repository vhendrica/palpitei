export const fmtOdd = (n: number) => `${n.toFixed(2)}x`;

export const fmtPts = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export function fmtData(iso: string) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'America/Fortaleza' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' });
  return `${dia.replace('.', '').toUpperCase()} • ${hora}`;
}

export function fmtWhats(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

export const STATUS_LABEL = {
  aberta: 'ABERTA',
  em_andamento: 'AO VIVO',
  finalizada: 'FINALIZADA',
} as const;
