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
    return 'O número é somado no placar do time pra decidir se você ganhou.\n\nEx.: "Casa -1" — some -1 nos gols do time da casa. Se ganhou 2x0, com o handicap fica 1x0 e você acertou. Se ganhou 1x0, fica 0x0: sem empate aqui, seu palpite perde.';
  if (g.startsWith('DUPLA CHANCE'))
    return 'Você ganha com 2 dos 3 resultados possíveis.\n\nEx.: "Casa ou Empate" — ganha se o time da casa vencer OU se empatar. Só perde se o time de fora ganhar.';
  if (g.startsWith('EMPATE ANULA'))
    return 'Se o jogo empatar, seu palpite é devolvido: não ganha nem perde fichas.\n\nEx.: apostou na Casa e deu 1x1? Seus pontos voltam como se você não tivesse palpitado.';
  if (g.startsWith('AMBOS'))
    return 'Os dois times precisam fazer pelo menos 1 gol cada.\n\nEx.: jogo termina 2x1 → "Sim" acerta. Termina 2x0 → "Não" acerta, porque o outro time zerou.';
  if (g.startsWith('ESCANTEIO'))
    return 'É o total de escanteios cobrados no jogo (ou só no 1º tempo, se estiver no nome).\n\nEx.: "Mais de 9.5" — precisa de 10 ou mais escanteios pra acertar. "Menos de 9.5" — 9 ou menos.';
  if (g.startsWith('CART'))
    return 'É o total de cartões (amarelos + vermelhos) do jogo.\n\nEx.: "Mais de 4.5" — precisa de 5 ou mais cartões. "Menos de 4.5" — 4 ou menos.';
  if (g.includes('1 TEMPO') || g.includes('PRIMEIRO TEMPO'))
    return 'Só conta o que acontece até o intervalo.\n\nEx.: "Gols 1º Tempo Mais de 0.5" — se sair pelo menos 1 gol no primeiro tempo, você acertou. O que acontece no 2º tempo não muda nada.';
  if (g.startsWith('ESPECIAL') || g.includes('EXATO'))
    return 'Mercados mais difíceis, por isso pagam mais.\n\nEx.: "Resultado Exato 2x1" — só acerta se o placar final for exatamente 2x1. 2x2 ou 3x1 já perde.';
  if (g.startsWith('GOLS'))
    return 'É o total de gols do jogo.\n\nEx.: "Mais de 2.5" — precisa de 3 ou mais gols pra acertar. "Menos de 2.5" — 2 ou menos.';
  return null;
}
