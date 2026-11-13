import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";

import { useTheme } from "../store/Theme";
import type { PalpiteiroView, Resultado } from "../types";
import { Ficha } from "./Ficha";
import { T } from "./ui";
import { fmtOdd, fmtPontos, rotuloPalpite } from "../lib/format";

const icone = (r: Resultado) =>
  r === "green" ? "checkmark-circle" : r === "red" ? "close-circle" : "time-outline";

/** Renderiza o bilhete de um palpiteiro (Simples + Múltiplas). Usado no histórico e no admin. */
export function PalpiteiroBilhete({ p }: { p: PalpiteiroView }) {
  const { palette: C } = useTheme();
  const cor = (r: Resultado) => (r === "green" ? C.primary : r === "red" ? C.danger : C.muted);
  return (
    <View>
      {p.palpites.map((a, i) => (
        <View key={i} className="flex-row items-center py-1">
          <View className="flex-1 pr-2">
            <T className="text-xs text-muted">{a.jogo}</T>
            <T className="text-sm">{rotuloPalpite(a.grupo, a.descricao)}</T>
          </View>
          {a.fichas != null ? (
            <View className="mr-2 flex-row items-center">
              <Ficha size={14} />
              <T className="ml-1 text-xs">{a.fichas}</T>
            </View>
          ) : null}
          <T className="mr-2 font-odds text-xs text-primary">{fmtOdd(a.multiplicador)}</T>
          <Ionicons name={icone(a.resultado)} size={16} color={cor(a.resultado)} />
        </View>
      ))}
      {p.potencial_simples ? (
        <T className="mt-1 text-right text-[11px] text-muted">
          Simples pode render até{" "}
          <T className="font-mont-xb text-[11px] text-primary">{fmtPontos(p.potencial_simples)} pts</T>
        </T>
      ) : null}
      {p.multiplas.map((m) => (
        <View key={m.numero} className="mt-1 rounded-lg bg-cardAlt p-2">
          <T className="font-mont-xb text-xs">
            Múltipla {m.numero} · {fmtOdd(m.odd)}
            {m.fichas != null ? ` · ${m.fichas} fichas` : ""}
            {m.ocultas ? ` · ${m.ocultas} oculta(s)` : ""}
          </T>
          {m.pernas.map((l, i) => (
            <View key={i} className="mt-1 flex-row items-center">
              <View className="flex-1 pr-2">
                <T className="text-xs text-muted">{l.jogo}</T>
                <T className="text-xs">
                  {rotuloPalpite(l.grupo, l.descricao)} @ {fmtOdd(l.odd)}
                </T>
              </View>
              <Ionicons name={icone(l.resultado)} size={14} color={cor(l.resultado)} />
            </View>
          ))}
          {m.potencial ? (
            <T className="mt-1.5 text-right text-[11px] text-muted">
              se todas baterem →{" "}
              <T className="font-mont-xb text-[11px] text-primary">{fmtPontos(m.potencial)} pts</T>
            </T>
          ) : null}
        </View>
      ))}
      {p.potencial != null ? (
        <View className="mt-2 flex-row items-center justify-between border-t border-line pt-2">
          <T className="font-mont-b text-xs text-muted">Potencial máximo</T>
          <T className="font-odds text-lg text-primary">{fmtPontos(p.potencial)} pts</T>
        </View>
      ) : null}
    </View>
  );
}