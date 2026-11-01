// Compatibilidade entre palpites do mesmo jogo numa múltipla.
// ESTE ARQUIVO É ESPELHADO EM mobile/src/lib/compat.ts (teste garante que são iguais).

export type OpcaoCompat = {
  jogo_id: string;
  time_casa: string;
  time_fora: string;
  grupo: string;
  descricao: string;
};

type Pred = (casa: number, fora: number) => boolean;

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const RESULTADO: Record<'C' | 'E' | 'F', Pred> = {
  C: (h, a) => h > a,
  E: (h, a) => h === a,
  F: (h, a) => a > h,
};

function lado(nome: string, o: OpcaoCompat): 'C' | 'E' | 'F' | null {
  const n = norm(nome);
  if (n === 'EMPATE') return 'E';
  if (n === norm(o.time_casa) || n === 'CASA' || n === 'CASA VENCE') return 'C';
  if (n === norm(o.time_fora) || n === 'FORA' || n === 'FORA VENCE') return 'F';
  return null;
}

/** A opção como condição sobre o placar final (null = mercado que não sabemos interpretar). */
export function predicado(o: OpcaoCompat): Pred | null {
  const g = norm(o.grupo);
  const d = norm(o.descricao);
  const gols = d.match(/^(MAIS|MENOS) DE (\d+(?:[.,]\d+)?)/);
  if (gols) {
    const x = parseFloat(gols[2].replace(',', '.'));
    return gols[1] === 'MAIS' ? (h, a) => h + a > x : (h, a) => h + a < x;
  }
  if (g.startsWith('AMBOS')) {
    if (d === 'SIM') return (h, a) => h > 0 && a > 0;
    if (d === 'NAO') return (h, a) => !(h > 0 && a > 0);
    return null;
  }
  if (d.includes(' OU ')) {
    const lados = d.split(' OU ').map((p) => lado(p, o));
    if (lados.some((l) => !l)) return null;
    return (h, a) => lados.some((l) => RESULTADO[l!](h, a));
  }
  const l = lado(d, o);
  if (l && (g === 'RESULTADO' || g === '' || g.startsWith('EMPATE ANULA'))) return RESULTADO[l];
  return null;
}

/**
 * Dois palpites do mesmo jogo não podem ficar na mesma múltipla quando nenhum placar faz os dois
 * baterem, ou quando um garante o outro (ex.: "casa vence" + "mais de 0.5 gols").
 * Opções da mesma pergunta (grupo) são sempre incompatíveis entre si.
 */
export function incompativeis(a: OpcaoCompat, b: OpcaoCompat): boolean {
  if (a.jogo_id !== b.jogo_id) return false;
  if (norm(a.grupo) === norm(b.grupo)) return true;
  const pa = predicado(a);
  const pb = predicado(b);
  if (!pa || !pb) return false;
  let ambos = false;
  let soA = false;
  let soB = false;
  for (let h = 0; h <= 10; h++) {
    for (let f = 0; f <= 10; f++) {
      const x = pa(h, f);
      const y = pb(h, f);
      if (x && y) ambos = true;
      else if (x) soA = true;
      else if (y) soB = true;
    }
  }
  return !ambos || !soA || !soB;
}

/** Produto exato das odds (2 casas cada), sem erro de ponto flutuante acumulado. */
export function oddTotal(odds: number[]): number {
  let n = 1n;
  let casas = 0;
  for (const o of odds) {
    n *= BigInt(Math.round(o * 100));
    casas += 2;
  }
  return Number(n) / 10 ** casas;
}

/** fichas × odd sem arredondar (limpa só o ruído de ponto flutuante). */
export const exato = (n: number) => Number(n.toFixed(8));
