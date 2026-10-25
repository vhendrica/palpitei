import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";

import { fmtOdd } from "../lib/format";
import { T } from "./ui";
import { useTheme } from "../store/Theme";

type Props = {
  descricao: string;
  multiplicador: number;
  selected?: boolean;
  resultado?: "green" | "red" | null;
  compact?: boolean;
  disabled?: boolean;
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
  onPress,
}: Props) {
  const { palette: C } = useTheme();
  const border =
    resultado === "green"
      ? "border-primary"
      : selected
        ? "border-primary"
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
    </Pressable>
  );
}
