import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";

import { fmtOdd } from "../lib/format";
import { Ficha } from "./Ficha";
import { T } from "./ui";
import { useTheme } from "../store/Theme";

type Props = {
  descricao: string;
  multiplicador: number;
  selected?: boolean;
  resultado?: "green" | "red" | null;
  compact?: boolean;
  disabled?: boolean;
  /** Fichas já confirmadas nesta opção: borda verde + selo com a pilha. */
  fichas?: number;
  /** Selos dos grupos do bilhete (S, M1, M2…) por cima da odd. */
  selos?: { label: string; cor: string }[];
  onPress?: () => void;
};

/** Botão estilo casa de aposta: [ DESCRIÇÃO   ODDx ] */
export function BetButton({
  descricao,
  multiplicador,
  selected,
  resultado,
  compact,
  disabled,
  fichas = 0,
  selos = [],
  onPress,
}: Props) {
  const { palette: C } = useTheme();
  const minha = fichas > 0 && !selected;
  const border =
    resultado === "green" || selected
      ? "border-primary"
      : minha
        ? "border-2 border-primary"
        : "border-line";
  const bg = selected ? "bg-primary" : "bg-cardAlt";
  const descColor = selected ? "text-onPrimary" : "text-fg";
  const oddColor = selected ? "text-onPrimary" : "text-primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-between rounded-lg border ${border} ${bg} ${
        compact ? "flex-1 flex-col items-start px-2.5 py-2" : "px-3.5 py-3"
      } ${disabled ? "" : "active:opacity-80"}`}
    >
      <View
        className="flex-row items-center"
        style={compact ? undefined : { flex: 1, marginRight: 8 }}
      >
        {resultado === "green" ? (
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={C.primary}
            style={{ marginRight: 6 }}
          />
        ) : resultado === "red" ? (
          <Ionicons
            name="close-circle"
            size={16}
            color={C.danger}
            style={{ marginRight: 6 }}
          />
        ) : null}
        <T
          className={`font-mont-sb ${compact ? "text-[10px]" : "text-[13px]"} ${descColor}`}
          numberOfLines={compact ? 1 : 2}
        >
          {descricao}
        </T>
      </View>
      <T
        className={`font-odds ${compact ? "mt-1 text-base" : "text-lg"} ${oddColor}`}
      >
        {fmtOdd(multiplicador)}
      </T>
      {selos.length > 0 ? (
        <View
          pointerEvents="none"
          className="flex-row"
          style={{ position: "absolute", top: -9, left: 0, right: 0, justifyContent: "center", gap: 2 }}
        >
          {selos.map((s) => (
            <View key={s.label} className="rounded-full px-1.5" style={{ backgroundColor: s.cor }}>
              <T className="font-mont-xb text-[9px] text-white">{s.label}</T>
            </View>
          ))}
        </View>
      ) : null}
      {fichas > 0 ? (
        <View
          className="flex-row items-center rounded-full bg-fg px-1.5 py-0.5"
          style={{ position: "absolute", top: -9, right: -4 }}
        >
          <T className="mr-0.5 font-odds text-[11px] text-bg">{fichas}</T>
          <Ficha size={11} />
        </View>
      ) : null}
    </Pressable>
  );
}
