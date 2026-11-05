import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { explicacaoDo } from "../lib/secoes";
import { useTheme } from "../store/Theme";
import { T } from "./ui";

/** Título do grupo de mercados com ícone (?) que abre um balão com a explicação. */
export function GrupoTitulo({ grupo }: { grupo: string }) {
  const { palette: C } = useTheme();
  const [aberto, setAberto] = useState(false);
  const dica = explicacaoDo(grupo);
  return (
    <View className="mb-1 flex-row items-center">
      <T className="font-mont-xb text-[11px] uppercase text-muted">{grupo}</T>
      {dica ? (
        <View style={{ position: "relative", zIndex: aberto ? 9999 : 0 }}>
          <Pressable
            onPress={() => setAberto((a) => !a)}
            hitSlop={8}
            accessibilityLabel={`Explicação: ${grupo}`}
          >
            <Ionicons
              name={aberto ? "help-circle" : "help-circle-outline"}
              size={15}
              color={aberto ? C.primary : C.muted}
              style={{ marginLeft: 4 }}
            />
          </Pressable>
          {aberto ? (
            <View style={{ position: "absolute", top: 22, left: -2, zIndex: 9999, width: 240, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, elevation: 24 }}>
              <View
                style={{
                  position: "absolute",
                  top: -4,
                  left: 12,
                  width: 10,
                  height: 10,
                  transform: [{ rotate: "45deg" }],
                  backgroundColor: C.card,
                  borderLeftWidth: 1,
                  borderTopWidth: 1,
                  borderColor: C.line,
                }}
              />
              <View
                style={{
                  backgroundColor: C.card,
                  borderWidth: 1,
                  borderColor: C.line,
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <T className="mb-1 font-mont-xb text-xs">{grupo}</T>
                <T className="text-xs text-muted">{dica}</T>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
