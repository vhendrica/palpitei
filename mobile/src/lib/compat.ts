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
  if (g.startsWith('HANDICAP')) {
    const hc = handicap(d, o);
    if (hc) return hc;
  }
  const l = lado(d, o);
  if (l && (g === 'RESULTADO' || g === '' || g.startsWith('EMPATE ANULA') || g === 'DUPLA CHANCE')) return RESULTADO[l];
  return null;
}

/**
 * Resultado que não muda mais com o placar parcial (gols só aumentam): true/false, ou null se ainda pode virar.
 */
export function decidido(p: Pred, casa: number, fora: number): boolean | null {
  const v = p(casa, fora);
  for (let h = 0; h <= 10; h++) {
    for (let a = 0; a <= 10; a++) if (p(casa + h, fora + a) !== v) return null;
  }
  return v;
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


/** Placares extras vindos do feed (escanteios, cartões, 1º tempo) — usados na apuração final. */
export type ExDados = {
  /** [casa, fora] */
  gols1t?: [number, number];
  escanteios?: [number, number];
  escanteios1t?: [number, number];
  cartoes?: [number, number];
};

const linha = (d: string) => {
  const m = d.match(/^(MAIS|MENOS) DE (\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  return { tipo: m[1] as 'MAIS' | 'MENOS', x: parseFloat(m[2].replace(',', '.')) };
};

const over = (tipo: 'MAIS' | 'MENOS', x: number): Pred =>
  tipo === 'MAIS' ? (h, a) => h + a > x : (h, a) => h + a < x;

/** Handicap: "CASA -1", "FORA +1.5", ou o nome do time com a linha (soma no placar). */
const handicap = (d: string, o: OpcaoCompat): Pred | null => {
  const m = d.match(/^(.*?)\s*([+-]\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const l = lado(m[1].trim() || 'CASA', o);
  if (!l) return null;
  const x = parseFloat(m[2].replace(',', '.'));
  return l === 'C' ? (h, a) => h + x > a : (h, a) => a + x > h;
};

/**
 * Predicado para mercados decididos com placar + estatísticas extras.
 * Escanteios/cartões/1º tempo só fecham no placar final (não entram no decidido parcial).
 */
export function predicadoEx(o: OpcaoCompat): ((d: ExDados) => boolean) | null {
  const g = norm(o.grupo);
  const d = norm(o.descricao);
  const t1 = g.includes('TEMPO') || g.endsWith(' 1T');
  const l = linha(d);
  const hc = handicap(d, o);
  if (g.startsWith('ESCANTEIO')) {
    if (l) {
      const p = over(l.tipo, l.x);
      return (x) => {
        const v = t1 ? x.escanteios1t : x.escanteios;
        return v != null && p(v[0], v[1]);
      };
    }
    if (hc) return (x) => x.escanteios != null && hc(x.escanteios[0], x.escanteios[1]);
    return null;
  }
  if (g.startsWith('CART')) {
    if (l) {
      const p = over(l.tipo, l.x);
      return (x) => x.cartoes != null && p(x.cartoes[0], x.cartoes[1]);
    }
    if (hc) return (x) => x.cartoes != null && hc(x.cartoes[0], x.cartoes[1]);
    return null;
  }
  if (t1) {
    if (l) {
      const p = over(l.tipo, l.x);
      return (x) => x.gols1t != null && p(x.gols1t[0], x.gols1t[1]);
    }
    if (hc) return (x) => x.gols1t != null && hc(x.gols1t[0], x.gols1t[1]);
    const s = lado(d, o);
    if (s) return (x) => x.gols1t != null && RESULTADO[s](x.gols1t[0], x.gols1t[1]);
  }
  return null;
}