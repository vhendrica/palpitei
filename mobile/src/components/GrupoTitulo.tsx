import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { explicacaoDo } from "../lib/secoes";
import { useTheme } from "../store/Theme";
import { T } from "./ui";

/** Título do grupo de mercados com ícone (?) que abre um balão por cima do conteúdo. */
export function GrupoTitulo({ grupo }: { grupo: string }) {
  const { palette: C } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const iconRef = useRef<View>(null);
  const dica = explicacaoDo(grupo);

  const abrir = () => {
    iconRef.current?.measureInWindow((x, y, w, h) => {
      setPos({ x, y: y + h + 6 });
    });
    setAberto(true);
  };

  return (
    <View className="mb-1 flex-row items-center">
      <T className="font-mont-xb text-[11px] uppercase text-muted">{grupo}</T>
      {dica ? (
        <View ref={iconRef} collapsable={false}>
          <Pressable onPress={abrir} hitSlop={8} accessibilityLabel={`Explicação: ${grupo}`}>
            <Ionicons name="help-circle-outline" size={15} color={C.muted} style={{ marginLeft: 4 }} />
          </Pressable>
        </View>
      ) : null}
      <Modal transparent visible={aberto} animationType="none" onRequestClose={() => setAberto(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setAberto(false)} />
        <View
          style={{
            position: "absolute",
            top: pos.y,
            left: Math.max(8, Math.min(pos.x, 300)),
            width: 260,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: -5,
              left: 10,
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
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 24,
            }}
          >
            <T className="mb-1 font-mont-xb text-xs">{grupo}</T>
            <T className="text-xs text-muted">{dica}</T>
          </View>
        </View>
      </Modal>
    </View>
  );
}
