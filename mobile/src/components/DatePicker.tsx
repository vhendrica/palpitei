import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, Pressable, TextInput, View } from "react-native";

import { ThemeVars, useTheme } from "../store/Theme";
import { T } from "./ui";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIA_SEM = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Calendário simples pra escolher uma data — devolve ISO (yyyy-mm-dd). */
export function DatePicker({
  visivel,
  onFechar,
  onEscolher,
}: {
  visivel: boolean;
  onFechar: () => void;
  onEscolher: (iso: string) => void;
}) {
  const { palette: { primary, card, line, fg } } = useTheme();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const primeiro = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array<null>(primeiro).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  const [digitada, setDigitada] = useState("");
  // Digitando dd/mm completo e válido, já escolhe (ano corrente; se a data já passou, o próximo).
  const digitar = (t: string) => {
    const n = t.replace(/\D/g, "").slice(0, 4);
    const txt = n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
    setDigitada(txt);
    if (n.length < 4) return;
    const [dd, mm] = [Number(n.slice(0, 2)), Number(n.slice(2))];
    let a = hoje.getFullYear();
    if (new Date(a, mm - 1, dd) < new Date(a, hoje.getMonth(), hoje.getDate())) a += 1;
    const dt = new Date(a, mm - 1, dd);
    if (dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return;
    onEscolher(`${a}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`);
    setDigitada("");
    onFechar();
  };

  const muda = (delta: number) => {
    const d = new Date(ano, mes + delta, 1);
    setMes(d.getMonth());
    setAno(d.getFullYear());
  };

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <ThemeVars>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: card, borderRadius: 16, borderWidth: 1, borderColor: line, padding: 16, width: "100%", maxWidth: 380, alignSelf: "center" }}>
          <View className="mb-3 flex-row items-center rounded-xl border border-line px-3">
            <Ionicons name="create-outline" size={16} color={line} />
            <TextInput
              value={digitada}
              onChangeText={digitar}
              placeholder="Digite a data (dd/mm)"
              placeholderTextColor={line}
              keyboardType="numeric"
              maxLength={5}
              className="ml-2 flex-1 py-2.5 font-mont-sb text-sm text-fg"
            />
          </View>
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
                    onEscolher(`${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
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
      </ThemeVars>
    </Modal>
  );
}
