/** Seções de mercado (UI) + explicações (?) em português pros mercados não triviais. */

export const SECOES = ['PRINCIPAL', 'GOLS', 'GOLS DO TIME', 'JOGADOR', 'ESCANTEIOS', 'ESCANTEIOS DO TIME', 'ESCANTEIOS 1º TEMPO', 'CARTÕES', 'CARTÕES DO TIME', 'CARTÕES 1º TEMPO', '1º TEMPO', 'HANDICAP'] as const;

/** Grupos de player props que aparecem na seção JOGADOR. */
const PROPS_JOGADOR = [
  'MARCA NO JOGO',
  'PRIMEIRO A MARCAR',
  'ÚLTIMO A MARCAR',
  'PRIMEIRO CARTÃO',
  'LEVA CARTÃO',
  'DÁ ASSISTÊNCIA',
  'MARCA 2+ GOLS',
  'FAZ 2+ CHUTES',
  'É IMPEDIDO',
  'COMETE 2+ FALTAS',
];

/** Mapeia o grupo do mercado pra uma das seções. */
export function secaoDo(grupo: string): (typeof SECOES)[number] {
  const g = grupo.toUpperCase();
  const t1 =
    g.includes('1 TEMPO') ||
    g.includes('1º TEMPO') ||
    g.includes('PRIMEIRO TEMPO') ||
    g.endsWith(' 1T');
  const porTime = /\b(CASA|FORA)\b/.test(g);
  // Props de jogador: checa antes de GOLS/CARTÕES ("GOLS DO JOGADOR" começa com GOLS).
  // O grupo pode vir com a linha no fim ("DEFESAS DO GOLEIRO 3.5"), então é contains, não endsWith.
  if (
    PROPS_JOGADOR.some((p) => g.startsWith(p)) ||
    g.includes('DO JOGADOR') ||
    g.includes('DO GOLEIRO')
  ) {
    return 'JOGADOR';
  }
  // Mercados por time têm seção própria em qualquer período (a seção é do time, não do período).
  if (g.startsWith('ESCANTEIO')) {
    if (porTime) return 'ESCANTEIOS DO TIME';
    return t1 ? 'ESCANTEIOS 1º TEMPO' : 'ESCANTEIOS';
  }
  if (g.startsWith('CART')) {
    if (porTime) return 'CARTÕES DO TIME';
    return t1 ? 'CARTÕES 1º TEMPO' : 'CARTÕES';
  }
  if (g.startsWith('GOLS CASA') || g.startsWith('GOLS FORA')) return 'GOLS DO TIME';
  if (t1) return '1º TEMPO';
  if (g.startsWith('GOLS')) return 'GOLS';
  if (g.startsWith('HANDICAP')) return 'HANDICAP';
  return 'PRINCIPAL';
}

/** Ordem fixa dos grupos dentro da seção PRINCIPAL (AMBOS sempre cola no RESULTADO). */
export const ORDEM_PRINCIPAL = [
  'RESULTADO',
  'AMBOS MARCAM',
  'AVANÇA / CAMPEÃO',
  'DUPLA CHANCE',
  'EMPATE ANULA',
];

/** Ordem de exibição das seções na tela de palpite; seção fora da lista vai pro fim. */
export function rankSecao(secao: string): number {
  const i = SECOES.indexOf(secao as (typeof SECOES)[number]);
  return i < 0 ? SECOES.length : i;
}

/** Família do grupo sem a linha: "GOLS 2.5" e "GOLS 3.5" ficam juntos em "GOLS". */
export function familiaGrupo(grupo: string): string {
  return grupo.replace(/\s[+-]?\d+(?:\.\d+)?$/, "");
}

/** Linha numérica no fim do grupo ("ESCANTEIOS 8.5" → 8.5); sem linha = 0. */
export function linhaGrupo(grupo: string): number {
  const m = grupo.match(/\s([+-]?\d+(?:\.\d+)?)$/);
  return m ? parseFloat(m[1]) : 0;
}

const numeroDo = (grupo: string): { n: number; s: string } | null => {
  // Ignora o "1º"/"2º" de "1º TEMPO": a linha do mercado é o número sem "º".
  const m = grupo.match(/(\d+(?:[.,]\d+)?)(?!\d|[.,]\d|º)/);
  if (!m) return null;
  const s = m[1].replace(',', '.');
  return { n: parseFloat(s), s };
};

const linhaAjuda = (grupo: string, unidade: string) => {
  const num = numeroDo(grupo);
  if (!num) return '';
  const menos = Math.floor(num.n);
  return `\n\n"Mais de ${num.s}" — precisa de ${menos + 1} ou mais ${unidade} pra acertar.\n"Menos de ${num.s}" — ${menos === 0 ? 'não pode sair nenhum' : `${menos} ou menos`}.`;
};

const PROPS_AJUDA: [prefixo: string, texto: string][] = [
  ['MARCA NO JOGO', 'O jogador precisa fazer pelo menos 1 gol no jogo (assistência não conta).\n\nEx.: palpitou "CALLERI" e ele marca o 1x0 → acertou. Se ele só der o passe pro gol, perde.'],
  ['PRIMEIRO A MARCAR', 'O jogador precisa fazer o PRIMEIRO gol do jogo.\n\nEx.: escolheu "CANO" e ele abre o placar → acertou. Se qualquer outro marcar antes, perde.'],
  ['ÚLTIMO A MARCAR', 'O jogador precisa fazer o ÚLTIMO gol do jogo.\n\nEx.: jogo acaba 3x1 e o seu escolhido fez o terceiro gol → acertou.'],
  ['PRIMEIRO CARTÃO', 'O jogador precisa receber o primeiro cartão (amarelo ou vermelho) do jogo.'],
  ['LEVA CARTÃO', 'Basta o jogador receber 1 cartão (amarelo ou vermelho) em qualquer momento do jogo.'],
  ['DÁ ASSISTÊNCIA', 'O jogador precisa dar pelo menos 1 assistência (o passe ou cruzamento direto pro gol).'],
  ['MARCA 2+ GOLS', 'O jogador precisa fazer 2 gols ou mais no jogo.\n\nEx.: marcou 1 só → perde; fez dobradinha → acertou.'],
  ['FAZ 2+ CHUTES', 'O jogador precisa finalizar 2 vezes ou mais — vale chute no gol, pra fora ou bloqueado.'],
  ['É IMPEDIDO', 'O jogador precisa ser pego em posição de impedimento pelo menos 1 vez.'],
  ['COMETE 2+ FALTAS', 'O jogador precisa cometer 2 faltas ou mais no jogo.'],
];

/** Props de contagem do jogador: prefixo, explicação e unidade da linha (ordem importa: "NO GOL" antes de "CHUTES"). */
const PROPS_TOTAIS: [prefixo: string, texto: string, unidade: string][] = [
  ['CHUTES NO GOL DO JOGADOR', 'Só contam as finalizações que vão NA DIREÇÃO do gol — chute pra fora ou bloqueado não entra.', 'chutes no gol'],
  ['CHUTES DO JOGADOR', 'Total de finalizações do jogador — vale chute no gol, pra fora ou bloqueado.', 'chutes'],
  ['GOLS DO JOGADOR', 'Total de gols que o jogador marca no jogo.', 'gols'],
  ['ASSISTÊNCIAS DO JOGADOR', 'Total de assistências do jogador (o passe ou cruzamento direto pro gol).', 'assistências'],
  ['CARTÕES DO JOGADOR', 'Total de cartões (amarelos + vermelhos) que o jogador recebe.', 'cartões'],
  ['DESARMES DO JOGADOR', 'Total de bolas que o jogador rouba do adversário (desarme).', 'desarmes'],
  ['DEFESAS DO GOLEIRO', 'Total de defesas que o goleiro faz.', 'defesas'],
  ['FALTAS DO JOGADOR', 'Total de faltas que o jogador comete.', 'faltas'],
  ['IMPEDIMENTOS DO JOGADOR', 'Total de vezes que o jogador é pego em posição de impedimento.', 'impedimentos'],
];

/** "1º tempo"/"intervalo" no nome do grupo. */
const primeiroTempo = (g: string) =>
  g.includes('1 TEMPO') || g.includes('1º TEMPO') || g.includes('PRIMEIRO TEMPO');

/** Nome do time embutido no grupo ("GOLS BOCA JUNIORS 2.5" → "BOCA JUNIORS"); null = mercado do jogo. */
const timeDoGrupo = (g: string, prefixo: string): string | null => {
  const fam = g.replace(/\s[+-]?\d+(?:\.\d+)?$/, '').slice(prefixo.length).trim();
  const semPeriodo = fam.replace(/\s*(1º? TEMPO|PRIMEIRO TEMPO)\s*$/i, '').trim();
  return semPeriodo || null;
};

const rotuloTime = (time: string) =>
  time === 'CASA' ? 'o time da casa' : time === 'FORA' ? 'o time visitante' : `o ${time}`;

/** Texto de ajuda do (?) por grupo/mercado — null nos comuns (1X2, gols simples). */
export function explicacaoDo(grupo: string): string | null {
  const g = grupo.toUpperCase();
  const t1 = primeiroTempo(g);
  if (g.startsWith('GOLS PAR OU ÍMPAR') || g.includes('PAR OU ÍMPAR')) {
    return 'É o total de gols DO JOGO (somando os dois times): saiu número par ou ímpar de gols?\n\nEx.: 2x1 = 3 gols → "TOTAL ÍMPAR" acerta. 1x1 = 2 gols → "TOTAL PAR". Atenção: 0x0 conta como par.';
  }
  for (const [p, texto] of PROPS_AJUDA) {
    if (g.startsWith(p)) return texto;
  }
  for (const [p, texto, unidade] of PROPS_TOTAIS) {
    if (g.startsWith(p)) return `${texto}${linhaAjuda(grupo, unidade)}`;
  }
  if (g.includes('DO JOGADOR') || g.includes('DO GOLEIRO')) {
    return `Estatística individual do jogador no jogo inteiro.${linhaAjuda(grupo, 'vezes')}`;
  }
  if (g.startsWith('AVANÇA')) {
    return 'Quem avança na fase — numa final, é o campeão. Conta o mata-mata inteiro: vale prorrogação e pênaltis, não só os 90 min.\n\nEx.: palpitou "BOCA JUNIORS" e ele classifica nos pênaltis → acertou, mesmo se o jogo empatou no tempo normal.';
  }
  if (g.startsWith('INTERVALO / FINAL')) {
    return 'Você acerta quem está vencendo NO INTERVALO e quem vence NO FIM.\n\nEx.: "CASA / EMPATE" — a casa ganha o 1º tempo e o jogo termina empatado. Os dois têm que bater juntos.';
  }
  if (g.startsWith('VIRA O JOGO')) {
    return 'O time precisa sair perdendo e virar o jogo.\n\nEx.: toma 1x0 e termina 2x1 → acertou. Se ganhou sem nunca estar atrás, perde.';
  }
  if (g.startsWith('VENCE SEM SOFRER GOL')) {
    return 'O time precisa vencer sem tomar nenhum gol.\n\nEx.: "CASA VENCE SEM SOFRER" — 2x0 acerta. Se sair 2x1, o gol sofrido quebra o palpite.';
  }
  if (g.startsWith('ESCANTEIOS HCP')) {
    return 'Handicap aplicado aos escanteios, não aos gols.\n\nEx.: "CASA -2.5" — a casa precisa cobrar 3+ escanteios a mais que o visitante. "FORA +2.5" — a fora pode ter até 2 escanteios a menos.';
  }
  if (g.startsWith('HANDICAP')) {
    return `O número é somado no placar${t1 ? ' do 1º tempo' : ''} do time pra decidir se você ganhou.\n\nEx.: "Casa -1" — some -1 nos gols${t1 ? ' do 1º tempo' : ''} do time da casa. Se ganhou 2x0${t1 ? ' até o intervalo' : ''}, com o handicap fica 1x0 e você acertou. Se ganhou 1x0, fica 0x0: sem empate aqui, seu palpite perde.`;
  }
  if (g.startsWith('DUPLA CHANCE')) {
    return 'Você ganha com 2 dos 3 resultados possíveis.\n\nEx.: "Casa ou Empate" — ganha se o time da casa vencer OU se empatar. Só perde se o time de fora ganhar.';
  }
  if (g.startsWith('EMPATE ANULA')) {
    return 'Se o jogo empatar, seu palpite é devolvido: não ganha nem perde fichas.\n\nEx.: apostou na Casa e deu 1x1? Seus pontos voltam como se você não tivesse palpitado.';
  }
  if (g.startsWith('AMBOS')) {
    return t1
      ? 'Os dois times precisam fazer pelo menos 1 gol cada SÓ NO 1º TEMPO.\n\nEx.: intervalo 1x1 → "Sim" acerta. Se um dos dois zerar no 1º tempo → "Não" acerta, mesmo se depois os dois marcarem no 2º tempo.'
      : 'Os dois times precisam fazer pelo menos 1 gol cada.\n\nEx.: jogo termina 2x1 → "Sim" acerta. Termina 2x0 → "Não" acerta, porque o outro time zerou.';
  }
  if (g.startsWith('ESCANTEIO')) {
    const time = timeDoGrupo(g, 'ESCANTEIOS');
    return `É o total de escanteios que ${time ? rotuloTime(time) : 'os dois times cobram no jogo, somados'}${time ? ' cobra' : ''}${t1 ? ' no 1º tempo' : ''}.${linhaAjuda(grupo, 'escanteios')}`;
  }
  if (g.startsWith('CART')) {
    const time = timeDoGrupo(g, 'CARTÕES');
    return `É o total de cartões (amarelos + vermelhos)${time ? ` que ${rotuloTime(time)} recebe` : ' do jogo'}${t1 ? ' no 1º tempo' : ''}.${linhaAjuda(grupo, 'cartões')}`;
  }
  if (g.includes('EXATO')) {
    return t1
      ? 'O placar DO 1º TEMPO tem que ser EXATAMENTE o escolhido.\n\nEx.: "1 x 0" só acerta se o intervalo for 1x0 — o que acontecer no 2º tempo não muda nada.'
      : 'O placar final tem que ser EXATAMENTE o escolhido.\n\nEx.: "2 x 1" só acerta se terminar 2x1 — 2x2 ou 3x1 já perde. Por isso a odd é alta.';
  }
  if (g.startsWith('ESPECIAL')) {
    return 'Mercados mais difíceis, por isso pagam mais.\n\nEx.: "Resultado Exato 2x1" — só acerta se o placar final for exatamente 2x1. 2x2 ou 3x1 já perde.';
  }
  if (g.startsWith('GOLS')) {
    const time = timeDoGrupo(g, 'GOLS');
    return `É o total de gols${time ? ` que ${rotuloTime(time)} faz` : ' do jogo (somando os dois times)'}${t1 ? ' no 1º tempo' : ''}.${linhaAjuda(grupo, 'gols')}`;
  }
  if (g.startsWith('RESULTADO')) {
    return t1
      ? 'Quem está vencendo NO INTERVALO — só o 1º tempo conta.\n\nEx.: palpitou "CASA" e o 1º tempo acaba 1x0 → acertou, mesmo se o jogo virar 1x2 no final.'
      : 'O clássico 1X2: quem vence o jogo no tempo regulamentar (90 min + acréscimos).\n\nEx.: palpitou "CASA" e termina 2x1 → acertou. Empate ou vitória do visitante, perde.';
  }
  return null;
}
