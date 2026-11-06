import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";

import { useTheme } from "../store/Theme";
import type { PalpiteiroView, Resultado } from "../types";
import { Ficha } from "./Ficha";
import { T } from "./ui";
import { fmtOdd, rotuloPalpite } from "../lib/format";

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
        </View>
      ))}
    </View>
  );
}