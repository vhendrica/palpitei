import { useState } from "react";
import { TextInput, View } from "react-native";

import type { Jogo } from "../types";
import { useTheme } from "../store/Theme";
import { Button, T } from "./ui";

type Chave = "placar" | "gols1t" | "escanteios" | "escanteios1t" | "cartoes";
const LINHAS: { k: Chave; nome: string }[] = [
  { k: "placar", nome: "Gols" },
  { k: "gols1t", nome: "Gols 1º tempo" },
  { k: "escanteios", nome: "Escanteios" },
  { k: "escanteios1t", nome: "Escanteios 1º tempo" },
  { k: "cartoes", nome: "Cartões" },
];

/**
 * Placar e estatísticas pós-jogo. O placar vem sozinho da API; escanteios e cartões o admin digita
 * (cada time) e todos os mercados de contagem são conferidos de uma vez.
 */
export function PlacarAdmin({
  jogo,
  onSalvar,
}: {
  jogo: Jogo;
  onSalvar: (body: { casa: number; fora: number } & Partial<Record<Exclude<Chave, "placar">, [number, number]>>) => void;
}) {
  const { palette: C } = useTheme();
  const ini = (k: Chave): [string, string] => {
    const v = k === "placar" ? (jogo.placar ? [jogo.placar.casa, jogo.placar.fora] : null) : jogo.estatisticas?.[k];
    return v ? [String(v[0]), String(v[1])] : ["", ""];
  };
  const [vals, setVals] = useState<Record<Chave, [string, string]>>(
    () => Object.fromEntries(LINHAS.map((l) => [l.k, ini(l.k)])) as Record<Chave, [string, string]>,
  );
  const [erro, setErro] = useState<string | null>(null);

  const salvar = () => {
    const num = (s: string) => (/^\d{1,2}$/.test(s.trim()) ? Number(s) : NaN);
    const [gc, gf] = vals.placar.map(num);
    if (!Number.isInteger(gc) || !Number.isInteger(gf)) return setErro("Preencha os gols dos dois times.");
    const body: Parameters<typeof onSalvar>[0] = { casa: gc, fora: gf };
    for (const { k, nome } of LINHAS) {
      if (k === "placar") continue;
      const [a, b] = vals[k];
      if (!a.trim() && !b.trim()) continue;
      const par = [num(a), num(b)];
      if (!par.every(Number.isInteger)) return setErro(`${nome}: preencha os dois times com números.`);
      body[k] = par as [number, number];
    }
    setErro(null);
    onSalvar(body);
  };

  const campo = (k: Chave, i: 0 | 1) => (
    <TextInput
      value={vals[k][i]}
      onChangeText={(t) => setVals((s) => ({ ...s, [k]: (i === 0 ? [t, s[k][1]] : [s[k][0], t]) as [string, string] }))}
      keyboardType="number-pad"
      maxLength={2}
      placeholder="–"
      placeholderTextColor={C.muted}
      className="w-12 rounded-lg border border-line py-1.5 text-center font-mont-b text-sm text-fg"
    />
  );

  return (
    <View className="mt-2 rounded-lg border border-line p-2">
      <T className="mb-1 text-[11px] uppercase tracking-widest text-muted">Placar e estatísticas</T>
      <View className="flex-row items-center pb-1">
        <View className="flex-1" />
        <T className="w-12 text-center text-[11px] text-muted" numberOfLines={1}>{jogo.time_casa}</T>
        <View className="w-3" />
        <T className="w-12 text-center text-[11px] text-muted" numberOfLines={1}>{jogo.time_fora}</T>
      </View>
      {LINHAS.map(({ k, nome }) => (
        <View key={k} className="flex-row items-center py-1">
          <T className="flex-1 text-sm">{nome}</T>
          {campo(k, 0)}
          <T className="w-3 text-center text-muted">x</T>
          {campo(k, 1)}
        </View>
      ))}
      <T className="mt-1 text-[11px] text-muted">
        Os mercados de placar, gols, escanteios e cartões são conferidos sozinhos. Jogador e especiais você marca
        no ✓/✗ de cada mercado.
      </T>
      {erro ? <T className="mt-1 text-xs text-danger">{erro}</T> : null}
      <Button compact title="Salvar e conferir mercados" icon="checkmark-done-outline" className="mt-2" onPress={salvar} />
    </View>
  );
}
