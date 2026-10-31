import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";

import { fmtPts } from "../lib/format";
import { useTheme } from "../store/Theme";
import type { Premio } from "../types";
import { T } from "./ui";

export const fmtReais = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Barra do prêmio: conta só quem entrou no palpite do dia; a última faixa da escada é a meta/teto. */
export function PremioBar({
  premio,
  finalizada,
  descricao,
}: {
  premio: Premio;
  finalizada?: boolean;
  descricao?: string | null;
}) {
  const { palette: C } = useTheme();
  const { meta, palpiteiros, premio_atual, meta_atingida, faltam_meta } =
    premio;
  const alvo = premio.proxima?.usuarios_min ?? meta?.usuarios_min ?? 0;
  const pct = alvo ? Math.min(100, Math.round((palpiteiros / alvo) * 100)) : 0;

  return (
    <View className="rounded-2xl border border-gold/40 bg-card p-4">
      <View className="flex-row items-center">
        <Ionicons name="trophy" size={22} color={C.gold} />
        <View className="ml-2.5 flex-1">
          <T className="font-mont-b text-[10px] uppercase tracking-widest text-muted">
            {finalizada ? "Prêmio final" : "Prêmio do campeão"}
          </T>
          {descricao ? (
            <T className="font-mont-xb text-lg text-gold">{descricao}</T>
          ) : null}
          {premio_atual > 0 || !descricao ? (
            <T className="font-odds text-2xl text-gold">
              {premio_atual > 0 ? fmtReais(premio_atual) : "—"}
            </T>
          ) : null}
        </View>
        <View className="items-end">
          <T className="font-odds text-xl">{fmtPts(palpiteiros)}</T>
          <T className="text-[10px] uppercase tracking-widest text-muted">
            palpiteiros
          </T>
        </View>
      </View>

      {meta && !descricao && !finalizada ? (
        <>
          <View className="mt-3 h-2 overflow-hidden rounded-full bg-cardAlt">
            <View
              className="h-2 rounded-full bg-gold"
              style={{ width: `${pct}%` }}
            />
          </View>
          <T className="mt-1.5 text-xs text-muted">
            {meta_atingida
              ? `Prêmio máximo garantido: ${fmtReais(meta.valor)}`
              : premio.proxima
                ? `Mais ${premio.proxima.faltam} ${premio.proxima.faltam === 1 ? "palpiteiro" : "palpiteiros"} e o prêmio vai pra ${fmtReais(premio.proxima.valor)}`
                : `Faltam ${faltam_meta} palpiteiros pro prêmio de ${fmtReais(meta.valor)}`}
          </T>
        </>
      ) : null}
    </View>
  );
}
