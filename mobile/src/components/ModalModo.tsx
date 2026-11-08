import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, View } from "react-native";

import { useTheme } from "../store/Theme";
import { T } from "./ui";

export type ModoDesafio = "grupo" | "duelo";

/** Modal de escolha de modo do desafio: Em grupo (vários) ou Duelo (1x1). */
export function ModalModo({
  visivel,
  onFechar,
  onEscolher,
}: {
  visivel: boolean;
  onFechar: () => void;
  onEscolher: (modo: ModoDesafio) => void;
}) {
  const { palette: C } = useTheme();
  return (
    <Modal transparent visible={visivel} animationType="fade" onRequestClose={onFechar}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}
        onPress={onFechar}
      >
        <View className="rounded-2xl bg-card p-4">
          <T className="mb-3 text-center font-mont-xb text-base">Que tipo de desafio?</T>
          {(
            [
              {
                key: "grupo" as const,
                titulo: "Em grupo",
                texto: "Todo mundo que receber o link pode entrar.",
              },
              {
                key: "duelo" as const,
                titulo: "Duelo",
                texto: "Só você contra mais 1 adversário.",
              },
            ]
          ).map((m) => (
            <Pressable
              key={m.key}
              className="mb-2 flex-row items-center rounded-xl border border-line p-3"
              onPress={() => onEscolher(m.key)}
            >
              {m.key === "duelo" ? (
                <View className="w-14 flex-row items-center justify-center">
                  <Ionicons name="person-outline" size={15} color={C.muted} />
                  <T className="mx-0.5 text-[11px] font-mont-xb text-muted">x</T>
                  <Ionicons name="person-outline" size={15} color={C.muted} />
                </View>
              ) : (
                <View className="w-14 flex-row flex-wrap items-center justify-center">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Ionicons key={i} name="person-outline" size={15} color={C.muted} />
                  ))}
                </View>
              )}
              <View className="ml-2 flex-1">
                <T className="font-mont-xb text-sm">{m.titulo}</T>
                <T className="mt-0.5 text-[11px] text-muted">{m.texto}</T>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
