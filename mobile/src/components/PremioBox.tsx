import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";

import { useTheme } from "../store/Theme";
import { T } from "./ui";

export function PremioBox({
  premio,
  size = "md",
  className = "",
}: {
  premio: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const { palette: C } = useTheme();
  const lg = size === "lg";
  return (
    <View
      className={`flex-row items-center rounded-xl border-l-4 border-gold bg-cardAlt px-3 py-2.5 ${className}`}
    >
      <Ionicons name="trophy" size={lg ? 20 : 18} color={C.gold} />
      <View className="ml-2.5 flex-1">
        <T className="font-mont-b text-[9px] uppercase tracking-widest text-muted">
          Prêmio do campeão
        </T>
        <T
          className={`font-mont-b text-fg ${lg ? "text-sm leading-[18px]" : "text-[13px] leading-[17px]"}`}
        >
          {premio}
        </T>
      </View>
    </View>
  );
}
