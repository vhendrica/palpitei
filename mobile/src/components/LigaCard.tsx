import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";

import { fmtData } from "../lib/format";
import type { Liga } from "../types";
import { Card, StatusBadge, T } from "./ui";
import type { ReactNode } from "react";
import { useTheme } from "../store/Theme";
import { PremioBox } from "./PremioBox";

export function LigaCard({
  liga,
  footer,
  participantes,
}: {
  liga: Liga;
  footer?: ReactNode;
  participantes?: number;
}) {
  const { palette: C } = useTheme();
  const [casa, fora] = liga.nome_jogo.split(/\s+x\s+/i);
  return (
    <Card className="mb-3">
      <View className="flex-row items-center justify-between">
        <T className="font-mont-sb text-[11px] text-muted">
          {fmtData(liga.data_jogo)}
        </T>
        <StatusBadge status={liga.status} />
      </View>
      <View className="mt-3 flex-row items-center">
        <T className="flex-1 font-mont-xb text-lg" numberOfLines={1}>
          {casa?.toUpperCase()}
        </T>
        <View className="mx-2 rounded bg-cardAlt px-2 py-0.5">
          <T className="font-mont-b text-xs text-muted">X</T>
        </View>
        <T className="flex-1 text-right font-mont-xb text-lg" numberOfLines={1}>
          {fora?.toUpperCase()}
        </T>
      </View>
      <View className="mt-2 flex-row items-center">
        <Ionicons name="location-outline" size={12} color={C.muted} />
        <T className="ml-1 text-xs text-muted">{liga.local}</T>
        {participantes !== undefined ? (
          <>
            <Ionicons
              name="people-outline"
              size={12}
              color={C.muted}
              style={{ marginLeft: 12 }}
            />
            <T className="ml-1 text-xs text-muted">
              {participantes} na disputa
            </T>
          </>
        ) : null}
      </View>
      <PremioBox premio={liga.premio_desc} className="mt-3" />
      {footer ? <View className="mt-3">{footer}</View> : null}
    </Card>
  );
}
