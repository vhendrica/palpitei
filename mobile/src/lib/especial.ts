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

const CONTAGEM = new Set([
  'GOLS DO JOGADOR',
  'ASSISTÊNCIAS DO JOGADOR',
  'CHUTES DO JOGADOR',
  'CHUTES NO GOL DO JOGADOR',
  'CARTÕES DO JOGADOR',
  'DESARMES DO JOGADOR',
  'DEFESAS DO GOLEIRO',
  'FALTAS DO JOGADOR',
  'IMPEDIMENTOS DO JOGADOR',
]);

const LINHA = /\s+(-?\d+(?:\.\d+)?)$/;

/** "DESARMES DO JOGADOR" + "MAIS DE 2.5" → "Desarmes do jogador 2.5+". */
function contagem(base: string, lado: string): string | null {
  const m = lado.match(/^(MAIS|MENOS) DE (\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const nome = base.charAt(0) + base.slice(1).toLowerCase();
  return `${nome} ${m[2]}${m[1] === 'MAIS' ? '+' : '-'}`;
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
  const partes = descricao.split(/\s+—\s+/);
  const [quem, lado] = partes;
  const jogador =
    partes.length === 1 ? FRASE[g] : partes.length === 2 && CONTAGEM.has(base) ? contagem(base, lado.trim().toUpperCase()) : null;
  if (jogador) {
    const tag = quem.match(/\s*\(([^)]+)\)\s*$/);
    const nome = tag ? quem.slice(0, tag.index).trim() : quem.trim();
    return { titulo: nomeCurto(nome), mercado: jogador, time: tag?.[1] ?? null };
  }
  const linha = g.match(LINHA)?.[1];
  const titulo = linha && descricao.includes(linha) ? base : grupo;
  return { titulo, mercado: frasePadrao(descricao), time: null };
}
