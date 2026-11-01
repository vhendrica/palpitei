import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { Animated, View } from "react-native";

import { useTheme } from "../store/Theme";
import { T } from "./ui";

export function useToast() {
  const [msg, setMsg] = useState<{ texto: string; id: number } | null>(null);
  const show = useCallback(
    (texto: string) => setMsg({ texto, id: Date.now() }),
    [],
  );
  const node = msg ? (
    <Toast key={msg.id} texto={msg.texto} onHide={() => setMsg(null)} />
  ) : null;
  return { show, node };
}

function Toast({ texto, onHide }: { texto: string; onHide: () => void }) {
  const { palette: C } = useTheme();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]);
    a.start(({ finished }) => finished && onHide());
    return () => a.stop();
  }, [anim, onHide]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 76,
        left: 16,
        right: 16,
        zIndex: 50,
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
        ],
      }}
    >
      <View className="flex-row items-center rounded-xl bg-primary px-4 py-3 shadow-lg">
        <Ionicons name="checkmark-circle" size={20} color={C.onPrimary} />
        <T className="ml-2 flex-1 font-mont-b text-sm text-onPrimary">{texto}</T>
      </View>
    </Animated.View>
  );
}
