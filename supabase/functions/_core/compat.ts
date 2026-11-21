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

/** Grupos que dependem de dado além do placar final (escanteios, cartões, 1º tempo). */
const precisaEx = (g: string) =>
  g.startsWith('ESCANTEIO') || g.startsWith('CART') || g.includes('TEMPO') || g.endsWith(' 1T') || g.startsWith('INTERVALO');

/** "FLAMENGO MAIS DE 1.5" -> lado do time + resto da descrição. */
function doTime(d: string, o: OpcaoCompat): { l: 'C' | 'F'; resto: string } | null {
  const c = norm(o.time_casa);
  const f = norm(o.time_fora);
  // O nome mais longo primeiro: "ATLETICO" não pode capturar "ATLETICO MINEIRO".
  const ordem: ['C' | 'F', string][] = c.length >= f.length ? [['C', c], ['F', f]] : [['F', f], ['C', c]];
  for (const [l, n] of ordem) if (n && d.startsWith(`${n} `)) return { l, resto: d.slice(n.length + 1) };
  return null;
}

/** Condição sobre o placar (casa, fora) — base comum do jogo inteiro e do 1º tempo. */
function predPlacar(g: string, d: string, o: OpcaoCompat): Pred | null {
  const gols = d.match(/^(MAIS|MENOS) DE (\d+(?:[.,]\d+)?)/);
  if (gols) {
    const x = parseFloat(gols[2].replace(',', '.'));
    return gols[1] === 'MAIS' ? (h, a) => h + a > x : (h, a) => h + a < x;
  }
  const t = doTime(d, o);
  if (t) {
    const m = t.resto.match(/^(MAIS|MENOS) DE (\d+(?:[.,]\d+)?)$/);
    if (m) {
      const x = parseFloat(m[2].replace(',', '.'));
      const v = (h: number, a: number) => (t.l === 'C' ? h : a);
      return m[1] === 'MAIS' ? (h, a) => v(h, a) > x : (h, a) => v(h, a) < x;
    }
    if (t.resto === 'VENCE SEM SOFRER') return t.l === 'C' ? (h, a) => h > a && a === 0 : (h, a) => a > h && h === 0;
  }
  if (g.startsWith('PLACAR')) {
    const m = d.match(/^(\d+) X (\d+)$/);
    if (m) return (h, a) => h === Number(m[1]) && a === Number(m[2]);
    return null;
  }
  if (d === 'TOTAL PAR') return (h, a) => (h + a) % 2 === 0;
  if (d === 'TOTAL IMPAR') return (h, a) => (h + a) % 2 === 1;
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
  if (l && (g.startsWith('RESULTADO') || g === '' || g.startsWith('EMPATE ANULA') || g === 'DUPLA CHANCE')) return RESULTADO[l];
  return null;
}

/** A opção como condição sobre o placar final (null = mercado que não sabemos interpretar). */
export function predicado(o: OpcaoCompat): Pred | null {
  const g = norm(o.grupo);
  if (precisaEx(g)) return null;
  return predPlacar(g, norm(o.descricao), o);
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
 * Mesma contagem (escanteios/cartões/1º tempo, mesmo time) em linhas diferentes: dependentes quando
 * vão no mesmo sentido (mais de 9.5 garante mais de 8.5) ou quando nenhum número faz as duas baterem.
 */
function linhasDependentes(a: OpcaoCompat, b: OpcaoCompat): boolean {
  const ga = norm(a.grupo);
  // Jogador: a descrição começa pelo nome, então só linhas do mesmo jogador se cruzam.
  if (!precisaEx(ga) && !ga.includes('JOGADOR')) return false;
  const familia = (g: string) => norm(g).replace(/\s[+-]?\d+(?:[.,]\d+)?$/, '');
  if (familia(a.grupo) !== familia(b.grupo)) return false;
  const lin = (d: string) => norm(d).match(/^(.*?)(MAIS|MENOS) DE ([\d.,]+)$/);
  const la = lin(a.descricao);
  const lb = lin(b.descricao);
  if (!la || !lb || la[1].trim() !== lb[1].trim()) return false;
  if (la[2] === lb[2]) return true;
  const mais = Number((la[2] === 'MAIS' ? la : lb)[3].replace(',', '.'));
  const menos = Number((la[2] === 'MAIS' ? lb : la)[3].replace(',', '.'));
  return Math.floor(mais) + 1 >= Math.ceil(menos);
}

/**
 * Dois palpites do mesmo jogo não podem ficar na mesma múltipla quando nenhum placar faz os dois
 * baterem, ou quando um garante o outro (ex.: "casa vence" + "mais de 0.5 gols").
 * Opções da mesma pergunta (grupo) são sempre incompatíveis entre si.
 */
export function incompativeis(a: OpcaoCompat, b: OpcaoCompat): boolean {
  if (a.jogo_id !== b.jogo_id) return false;
  if (norm(a.grupo) === norm(b.grupo)) return true;
  if (linhasDependentes(a, b)) return true;
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


/** Dados além do placar final (1º tempo, escanteios, cartões) — usados na apuração final. */
export type ExDados = {
  /** [casa, fora] */
  placar?: [number, number];
  gols1t?: [number, number];
  escanteios?: [number, number];
  escanteios1t?: [number, number];
  cartoes?: [number, number];
};

const linha = (d: string) => {
  const m = d.match(/^(MAIS|MENOS) DE (\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  return { tipo: m[1] as 'MAIS' | 'MENOS', x: parseFloat(m[2].replace(',', '.')) };
};

/** Handicap: "CASA -1", "FORA +1.5", ou o nome do time com a linha (soma no placar). */
const handicap = (d: string, o: OpcaoCompat): Pred | null => {
  const m = d.match(/^(.*?)\s*([+-]\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  const l = lado(m[1].trim() || 'CASA', o);
  if (!l) return null;
  const x = parseFloat(m[2].replace(',', '.'));
  return l === 'C' ? (h, a) => h + x > a : (h, a) => a + x > h;
};

/** Contagem (escanteios/cartões): total "MAIS DE x", por time "TIME MAIS DE x" ou handicap. */
function predContagem(d: string, o: OpcaoCompat): Pred | null {
  const l = linha(d);
  if (l) return l.tipo === 'MAIS' ? (h, a) => h + a > l.x : (h, a) => h + a < l.x;
  const t = doTime(d, o);
  const lt = t ? linha(t.resto) : null;
  if (t && lt) {
    const v = (h: number, a: number) => (t.l === 'C' ? h : a);
    return lt.tipo === 'MAIS' ? (h, a) => v(h, a) > lt.x : (h, a) => v(h, a) < lt.x;
  }
  return handicap(d, o);
}

const com = (v: [number, number] | undefined, p: Pred) => (v == null ? null : p(v[0], v[1]));

/**
 * Predicado para mercados decididos com placar + estatísticas extras.
 * Escanteios/cartões/1º tempo só fecham no placar final (não entram no decidido parcial).
 */
export function predicadoEx(o: OpcaoCompat): ((d: ExDados) => boolean | null) | null {
  const g = norm(o.grupo);
  const d = norm(o.descricao);
  const t1 = g.includes('TEMPO') || g.endsWith(' 1T');
  if (g.startsWith('ESCANTEIO')) {
    const p = predContagem(d, o);
    return p ? (x) => com(t1 ? x.escanteios1t : x.escanteios, p) : null;
  }
  if (g.startsWith('CART')) {
    const p = predContagem(d, o);
    return p ? (x) => com(x.cartoes, p) : null;
  }
  if (g.startsWith('INTERVALO')) {
    const [a, b] = d.split(' / ').map((s) => lado(s.trim(), o));
    if (!a || !b) return null;
    return (x) => (x.gols1t == null || x.placar == null ? null : RESULTADO[a](...x.gols1t) && RESULTADO[b](...x.placar));
  }
  if (t1) {
    const p = predPlacar(g, d, o);
    return p ? (x) => com(x.gols1t, p) : null;
  }
  return null;
}
