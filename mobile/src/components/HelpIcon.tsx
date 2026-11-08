import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { useTheme } from "../store/Theme";
import { T } from "./ui";

/** Ícone (?) que abre um balão de ajuda por cima de tudo (mesmo visual do palpite). */
export function HelpIcon({ texto, size = 15 }: { texto: string; size?: number }) {
  const { palette: C } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const iconRef = useRef<any>(null);

  const abrir = () => {
    iconRef.current?.measureInWindow?.((x: number, y: number, w: number, h: number) => {
      setPos({ x, y: y + h + 6 });
    });
    setAberto(true);
  };

  return (
    <>
      <View ref={iconRef} collapsable={false}>
        <Pressable onPress={abrir} hitSlop={8} accessibilityLabel="Ajuda">
          <Ionicons name="help-circle-outline" size={size} color={C.muted} />
        </Pressable>
      </View>
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
            <T className="text-xs text-muted">{texto}</T>
          </View>
        </View>
      </Modal>
    </>
  );
}
