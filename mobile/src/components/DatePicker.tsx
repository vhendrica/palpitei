import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { useTheme } from "../store/Theme";
import { T } from "./ui";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIA_SEM = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Calendário simples pra escolher uma data — devolve ISO (yyyy-mm-dd) ou dd/mm via `formato`. */
export function DatePicker({
  visivel,
  onFechar,
  onEscolher,
}: {
  visivel: boolean;
  onFechar: () => void;
  onEscolher: (ddmm: string) => void;
}) {
  const { palette: { primary, card, line, fg, muted } } = useTheme();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const primeiro = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array<null>(primeiro).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  const muda = (delta: number) => {
    const d = new Date(ano, mes + delta, 1);
    setMes(d.getMonth());
    setAno(d.getFullYear());
  };

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: card, borderRadius: 16, borderWidth: 1, borderColor: line, padding: 16 }}>
          <View className="flex-row items-center justify-between mb-3">
            <Pressable onPress={() => muda(-1)} className="p-2" hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={fg} />
            </Pressable>
            <T className="font-mont-xb text-sm">{MESES[mes]} {ano}</T>
            <Pressable onPress={() => muda(1)} className="p-2" hitSlop={8}>
              <Ionicons name="chevron-forward" size={20} color={fg} />
            </Pressable>
          </View>
          <View className="flex-row mb-1">
            {DIA_SEM.map((d, i) => (
              <T key={i} className="text-center text-muted" style={{ width: "14.28%", fontSize: 10 }}>{d}</T>
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {celulas.map((dia, i) => {
              const passado =
                dia !== null &&
                new Date(ano, mes, dia) < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
              return (
                <Pressable
                  key={i}
                  disabled={dia === null || passado}
                  onPress={() => {
                    onEscolher(`${String(dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}`);
                    onFechar();
                  }}
                  style={{ width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" }}
                >
                  {dia !== null ? (
                    <View
                      style={{
                        backgroundColor:
                          dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear()
                            ? primary + "22"
                            : "transparent",
                        borderRadius: 999,
                        width: 32,
                        height: 32,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <T
                        style={{ color: passado ? line : fg }}
                        className="font-mont-b text-xs"
                      >
                        {dia}
                      </T>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onFechar} className="mt-3 items-center py-2">
            <T className="text-muted text-xs">Fechar</T>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
