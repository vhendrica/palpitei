// Rascunho do bilhete: palpites escolhidos e em quais grupos (Simples / Múltipla N) cada um entra.
import type { Scheme } from "./theme";

export type MultiplaDraft = { mercados: string[]; fichas: number };
export type Draft = {
  /** Palpites na ordem em que foram escolhidos. */
  itens: string[];
  /** Palpites na Simples → fichas. */
  simples: Record<string, number>;
  multiplas: MultiplaDraft[];
};

export const DRAFT_VAZIO: Draft = { itens: [], simples: {}, multiplas: [] };

const semMultiplasVazias = (ms: MultiplaDraft[]) => ms.filter((m) => m.mercados.length > 0);

export function removerPalpite(d: Draft, id: string): Draft {
  const { [id]: _, ...simples } = d.simples;
  return {
    itens: d.itens.filter((x) => x !== id),
    simples,
    multiplas: semMultiplasVazias(
      d.multiplas.map((m) => ({ ...m, mercados: m.mercados.filter((x) => x !== id) })),
    ),
  };
}

/** Tocar numa odd: entra no bilhete já na Simples; tocar de novo tira de tudo. */
export function alternarOdd(d: Draft, id: string): Draft {
  if (d.itens.includes(id)) return removerPalpite(d, id);
  return { ...d, itens: [...d.itens, id], simples: { ...d.simples, [id]: 0 } };
}

export function alternarSimples(d: Draft, id: string): Draft {
  if (id in d.simples) {
    const { [id]: _, ...simples } = d.simples;
    return { ...d, simples };
  }
  return { ...d, simples: { ...d.simples, [id]: 0 } };
}

export function alternarMultipla(d: Draft, id: string, idx: number): Draft {
  const multiplas = d.multiplas.map((m, i) =>
    i !== idx
      ? m
      : {
          ...m,
          mercados: m.mercados.includes(id)
            ? m.mercados.filter((x) => x !== id)
            : [...m.mercados, id],
        },
  );
  return { ...d, multiplas: semMultiplasVazias(multiplas) };
}

export function novaMultipla(d: Draft, id: string): Draft {
  return { ...d, multiplas: [...d.multiplas, { mercados: [id], fichas: 0 }] };
}

export const semGrupo = (d: Draft, id: string) =>
  !(id in d.simples) && !d.multiplas.some((m) => m.mercados.includes(id));

export const fichasNoDraft = (d: Draft) =>
  d.itens.reduce((s, id) => s + (d.simples[id] ?? 0), 0) +
  d.multiplas.reduce((s, m) => s + m.fichas, 0);

const CORES: Record<Scheme, string[]> = {
  light: ["#2563EB", "#C026D3", "#0891B2", "#DB2777"],
  dark: ["#4D8DFF", "#E879F9", "#22D3EE", "#FF6FB5"],
};

/** Cor da Múltipla N (0 = Múltipla 1). Simples usa a cor principal do tema. */
export const corMultipla = (i: number, scheme: Scheme) => CORES[scheme][i % CORES[scheme].length];
