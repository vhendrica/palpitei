/** Seções de mercado (UI) + explicações (?) em português pros mercados não triviais. */

export const SECOES = ['PRINCIPAL', 'GOLS', 'HANDICAP', 'ESCANTEIOS', 'CARTÕES', '1º TEMPO', 'ESPECIAIS'] as const;

/** Mapeia o grupo do mercado pra uma das seções. */
export function secaoDo(grupo: string): (typeof SECOES)[number] {
  const g = grupo.toUpperCase();
  const t1 = g.includes('1 TEMPO') || g.includes('PRIMEIRO TEMPO') || g.endsWith(' 1T');
  if (t1) return '1º TEMPO';
  if (g.startsWith('HANDICAP')) return 'HANDICAP';
  if (g.startsWith('ESCANTEIO')) return 'ESCANTEIOS';
  if (g.startsWith('CART')) return 'CARTÕES';
  if (g.startsWith('GOLS') || g.startsWith('AMBOS')) return 'GOLS';
  if (g.startsWith('ESPECIAL') || g.includes('EXATO') || g.includes('MARCAR')) return 'ESPECIAIS';
  return 'PRINCIPAL';
}

/** Texto de ajuda do (?) por grupo/mercado — null nos comuns (1X2, gols simples). */
export function explicacaoDo(grupo: string): string | null {
  const g = grupo.toUpperCase();
  if (g.startsWith('HANDICAP'))
    return 'Handicap: o número é somado no placar do time. Ex.: Casa -1.5 precisa vencer por 2+ gols. Não tem empate/devolução aqui: se a soma empatar, o palpite perde.';
  if (g.startsWith('DUPLA CHANCE'))
    return 'Dupla Chance: você ganha se 2 dos 3 resultados possíveis acontecerem (ex.: Casa OU Empate).';
  if (g.startsWith('EMPATE ANULA'))
    return 'Empate Anula: se o jogo empatar, o palpite não pontua — como se você não tivesse feito.';
  if (g.startsWith('AMBOS'))
    return 'Ambas Marcam: precisa que os dois times façam pelo menos 1 gol cada.';
  if (g.startsWith('ESCANTEIO'))
    return 'Escanteios: total de escanteios do jogo (ou do tempo indicado). MAIS DE X = acima do número, MENOS DE X = abaixo.';
  if (g.startsWith('CART'))
    return 'Cartões: total de cartões (amarelos + vermelhos) do jogo. MAIS DE X = acima, MENOS DE X = abaixo.';
  if (g.includes('1 TEMPO') || g.includes('PRIMEIRO TEMPO'))
    return '1º Tempo: só conta o que acontece até o intervalo.';
  if (g.startsWith('ESPECIAL') || g.includes('EXATO'))
    return 'Especiais: mercados difíceis e com odds altas — resultado exato, primeiro a marcar etc.';
  if (g.startsWith('GOLS'))
    return 'Gols: total de gols do jogo. MAIS DE X = acima do número, MENOS DE X = abaixo.';
  return null;
}