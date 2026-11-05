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
  if (g.startsWith('GOLS')) return 'GOLS';
  if (g.startsWith('ESPECIAL') || g.includes('EXATO') || g.includes('MARCAR')) return 'ESPECIAIS';
  return 'PRINCIPAL';
}

const numeroDo = (grupo: string): { n: number; s: string } | null => {
  const m = grupo.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const s = m[1].replace(',', '.');
  return { n: parseFloat(s), s };
};

const linhaAjuda = (grupo: string, unidade: string) => {
  const num = numeroDo(grupo);
  if (!num) return '';
  const menos = Math.floor(num.n);
  return `\n\n"Mais de ${num.s}" — precisa de ${menos + 1} ou mais ${unidade} pra acertar.\n"Menos de ${num.s}" — ${menos === 0 ? '0, ou seja, nenhum' : `${menos} ou menos`}.`;
};

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
    return `É o total de escanteios cobrados no jogo (ou só no 1º tempo, se estiver no nome).${linhaAjuda(grupo, 'escanteios')}`;
  if (g.startsWith('CART'))
    return `É o total de cartões (amarelos + vermelhos) do jogo.${linhaAjuda(grupo, 'cartões')}`;
  if (g.includes('1 TEMPO') || g.includes('PRIMEIRO TEMPO'))
    return `Só conta o que acontece até o intervalo.${linhaAjuda(grupo, 'no primeiro tempo')}`;
  if (g.startsWith('ESPECIAL') || g.includes('EXATO'))
    return 'Mercados mais difíceis, por isso pagam mais.\n\nEx.: "Resultado Exato 2x1" — só acerta se o placar final for exatamente 2x1. 2x2 ou 3x1 já perde.';
  if (g.startsWith('GOLS'))
    return `É o total de gols do jogo.${linhaAjuda(grupo, 'gols')}`;
  return null;
}
