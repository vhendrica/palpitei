export type Faixa = { ordem: number; usuarios_min: number; valor: number };

export type ProgressoPremio = {
  palpiteiros: number;
  premio_inicial: number;
  premio_atual: number;
  proxima: { usuarios_min: number; valor: number; faltam: number } | null;
  meta: { usuarios_min: number; valor: number } | null;
  faltam_meta: number;
  meta_atingida: boolean;
  escada: Faixa[];
};

const ordenar = (escada: Faixa[]) => [...escada].sort((a, b) => a.ordem - b.ordem);

/**
 * Valor da faixa atingida, limitado ao teto (última faixa = META). Abaixo da 1ª faixa vale o prêmio
 * inicial (a rodada já começa valendo esse valor).
 */
export function resolverPremio(escada: Faixa[], palpiteiros: number, inicial = 0): number {
  const faixas = ordenar(escada);
  const meta = faixas.at(-1);
  if (!meta) return inicial;
  const atingida = faixas.filter((f) => palpiteiros >= f.usuarios_min).at(-1);
  return Math.max(inicial, atingida ? Math.min(atingida.valor, meta.valor) : 0);
}

export function progressoPremio(
  escada: Faixa[],
  palpiteiros: number,
  premioFinal?: number | null,
  inicial = 0,
): ProgressoPremio {
  const faixas = ordenar(escada);
  const meta = faixas.at(-1) ?? null;
  const proxima = faixas.find((f) => palpiteiros < f.usuarios_min && f.valor > inicial) ?? null;
  const metaAtingida = !!meta && palpiteiros >= meta.usuarios_min;
  return {
    palpiteiros,
    premio_inicial: inicial,
    premio_atual: premioFinal ?? resolverPremio(faixas, palpiteiros, inicial),
    proxima: proxima
      ? { usuarios_min: proxima.usuarios_min, valor: proxima.valor, faltam: proxima.usuarios_min - palpiteiros }
      : null,
    meta: meta ? { usuarios_min: meta.usuarios_min, valor: meta.valor } : null,
    faltam_meta: meta ? Math.max(0, meta.usuarios_min - palpiteiros) : 0,
    meta_atingida: metaAtingida,
    escada: faixas,
  };
}

/** Faixas precisam crescer em usuários e em valor (a última é a meta/teto). */
export function validarEscada(faixas: { usuarios_min: number; valor: number }[], inicial = 0) {
  if (faixas.length === 0) return 'Cadastre pelo menos uma faixa de prêmio.';
  if (faixas[0].valor <= inicial) return 'A 1ª faixa precisa valer mais que o prêmio inicial.';
  for (const [i, f] of faixas.entries()) {
    if (!Number.isInteger(f.usuarios_min) || f.usuarios_min <= 0) return 'Quantidade de palpiteiros inválida.';
    if (!(f.valor > 0)) return 'Valor do prêmio inválido.';
    const ant = faixas[i - 1];
    if (ant && (f.usuarios_min <= ant.usuarios_min || f.valor < ant.valor)) {
      return 'As faixas precisam crescer em palpiteiros e valor; a última é a meta.';
    }
  }
  return null;
}
