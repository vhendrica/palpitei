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
}: {
  premio: Premio;
  finalizada?: boolean;
}) {
  const { palette: C } = useTheme();
  const { meta, palpiteiros, premio_atual, meta_atingida, faltam_meta } =
    premio;
  const pct = meta
    ? Math.min(100, Math.round((palpiteiros / meta.usuarios_min) * 100))
    : 0;

  return (
    <View className="rounded-2xl border border-gold/40 bg-card p-4">
      <View className="flex-row items-center">
        <Ionicons name="trophy" size={22} color={C.gold} />
        <View className="ml-2.5 flex-1">
          <T className="font-mont-b text-[10px] uppercase tracking-widest text-muted">
            {finalizada ? "Prêmio final" : "Prêmio do campeão"}
          </T>
          <T className="font-odds text-2xl text-gold">
            {premio_atual > 0 ? fmtReais(premio_atual) : "—"}
          </T>
        </View>
        <View className="items-end">
          <T className="font-odds text-xl">{fmtPts(palpiteiros)}</T>
          <T className="text-[10px] uppercase tracking-widest text-muted">
            palpiteiros
          </T>
        </View>
      </View>

      {meta ? (
        <>
          <View className="mt-3 h-3 overflow-hidden rounded-full bg-cardAlt">
            <View
              className="h-3 rounded-full bg-gold"
              style={{ width: `${pct}%` }}
            />
          </View>
          <View className="mt-1.5 flex-row justify-between">
            {premio.escada.map((f) => (
              <T
                key={f.ordem}
                className={`text-[10px] ${palpiteiros >= f.usuarios_min ? "font-mont-b text-gold" : "text-muted"}`}
              >
                {f.usuarios_min} → {fmtReais(f.valor)}
              </T>
            ))}
          </View>
          <T className="mt-2 font-mont-b text-sm">
            {meta_atingida
              ? `Meta atingida — prêmio de ${fmtReais(meta.valor)}`
              : `Faltam ${faltam_meta} palpiteiros pra meta de ${fmtReais(meta.valor)}`}
          </T>
          {!meta_atingida &&
          premio.proxima &&
          premio.proxima.usuarios_min !== meta.usuarios_min ? (
            <T className="text-xs text-muted">
              Próxima faixa: {fmtReais(premio.proxima.valor)} com mais{" "}
              {premio.proxima.faltam} palpiteiros
            </T>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
