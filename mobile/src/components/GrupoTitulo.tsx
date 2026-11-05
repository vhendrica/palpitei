import Ionicons from "@expo/vector-icons/Ionicons";
import { Alert, Platform, Pressable, View } from "react-native";

import { explicacaoDo } from "../lib/secoes";
import { useTheme } from "../store/Theme";
import { T } from "./ui";

/** Título do grupo de mercados com ícone (?) que explica o mercado em português. */
export function GrupoTitulo({ grupo }: { grupo: string }) {
  const { palette: C } = useTheme();
  const dica = explicacaoDo(grupo);
  return (
    <View className="mb-1 flex-row items-center">
      <T className="font-mont-xb text-[11px] uppercase text-muted">{grupo}</T>
      {dica ? (
        <Pressable
          onPress={() =>
            Platform.OS === "web"
              ? window.alert(`${grupo}\n\n${dica}`)
              : Alert.alert(grupo, dica)
          }
          hitSlop={8}
          accessibilityLabel={`Explicação: ${grupo}`}
        >
          <Ionicons name="help-circle-outline" size={15} color={C.muted} style={{ marginLeft: 4 }} />
        </Pressable>
      ) : null}
    </View>
  );
}