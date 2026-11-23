const PARTICULAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E']);

/** Nome de registro do feed ("GABRIEL MORAIS SILVA BONTEMPO") → primeiro + último sobrenome. */
export function nomeCurto(nome: string) {
  const p = nome.trim().split(/\s+/);
  if (p.length <= 2) return p.join(' ');
  const ultimo = [...p].reverse().find((x) => !PARTICULAS.has(x.toUpperCase())) ?? p[p.length - 1];
  return `${p[0]} ${ultimo}`;
}

const FRASE: Record<string, string> = {
  'MARCA NO JOGO': 'Marca no jogo',
  'PRIMEIRO A MARCAR': 'Primeiro a marcar',
  'ÚLTIMO A MARCAR': 'Último a marcar',
  'PRIMEIRO CARTÃO': 'Primeiro cartão',
  'LEVA CARTÃO': 'Leva cartão',
  'DÁ ASSISTÊNCIA': 'Dá assistência',
  'MARCA 2+ GOLS': 'Marca 2+ gols',
  'FAZ 2+ CHUTES': '2+ chutes',
  'É IMPEDIDO': 'Fica impedido',
  'COMETE 2+ FALTAS': '2+ faltas',
};

/** [singular, plural, feminino] */
const CONTAGEM: Record<string, [string, string, boolean?]> = {
  'GOLS DO JOGADOR': ['gol', 'gols'],
  'ASSISTÊNCIAS DO JOGADOR': ['assistência', 'assistências', true],
  'CHUTES DO JOGADOR': ['chute', 'chutes'],
  'CHUTES NO GOL DO JOGADOR': ['chute no gol', 'chutes no gol'],
  'CARTÕES DO JOGADOR': ['cartão', 'cartões'],
  'DESARMES DO JOGADOR': ['desarme', 'desarmes'],
  'DEFESAS DO GOLEIRO': ['defesa', 'defesas', true],
  'FALTAS DO JOGADOR': ['falta', 'faltas', true],
  'IMPEDIMENTOS DO JOGADOR': ['impedimento', 'impedimentos'],
};

const LINHA = /\s+(-?\d+(?:\.\d+)?)$/;

function contagem(base: string, lado: string): string | null {
  const nomes = CONTAGEM[base];
  const m = lado.match(/^(MAIS|MENOS) DE (\d+(?:\.\d+)?)$/);
  if (!nomes || !m) return null;
  const h = Number(m[2]);
  const [um, varios, fem] = nomes;
  if (m[1] === 'MAIS') {
    const n = Math.ceil(h);
    if (n === 1 && base === 'CARTÕES DO JOGADOR') return 'Leva cartão';
    return `${n}+ ${n === 1 ? um : varios}`;
  }
  const n = Math.floor(h);
  if (n === 0) return `${fem ? 'Nenhuma' : 'Nenhum'} ${um}`;
  return `Até ${n} ${n === 1 ? um : varios}`;
}

const frasePadrao = (s: string) =>
  s.replace(/^MAIS DE /, 'Mais de ').replace(/^MENOS DE /, 'Menos de ').replace(/^SIM$/, 'Sim').replace(/^NÃO$/, 'Não');

/**
 * Texto compacto do card de especial: jogador (nome curto) como título e o mercado em frase curta,
 * sem repetir a linha. `time` é o time do jogador, quando o feed informa.
 */
export function textoEspecial(grupo: string, descricao: string): { titulo: string; mercado: string; time: string | null } {
  const g = grupo.trim().toUpperCase();
  const base = g.replace(LINHA, '');
  const [quem, lado = ''] = descricao.split(/\s+—\s+/);
  const jogador = FRASE[g] ?? (CONTAGEM[base] ? contagem(base, lado.trim().toUpperCase()) : null);
  if (jogador) {
    const tag = quem.match(/\s*\(([^)]+)\)\s*$/);
    const nome = tag ? quem.slice(0, tag.index).trim() : quem.trim();
    return { titulo: nomeCurto(nome), mercado: jogador, time: tag?.[1] ?? null };
  }
  const linha = g.match(LINHA)?.[1];
  const titulo = linha && descricao.includes(linha) ? base : grupo;
  return { titulo, mercado: frasePadrao(descricao), time: null };
}
