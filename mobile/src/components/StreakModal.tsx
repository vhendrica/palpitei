import { useEffect } from "react";
import { Modal, Pressable, View } from "react-native";

import { T } from "./ui";

const CURVA = [40, 50, 60, 70, 80, 90, 110];

/**
 * Modal do bônus de login diário: fecha sozinho em ~4s ou no toque/✕.
 * `quebrou` = a sequência zerou (faltou um dia).
 */
export function StreakModal({
  dia,
  pontos,
  quebrou,
  onFechar,
}: {
  dia: number;
  pontos: number;
  quebrou: boolean;
  onFechar: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onFechar, 4000);
    return () => clearTimeout(t);
  }, [onFechar]);

  const amanha = CURVA[Math.min(dia, 6)]; // CURVA[dia] = dia seguinte (dia é 1-based)

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onFechar}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 24 }}
        onPress={onFechar}
      >
        <View className="rounded-2xl border border-line bg-card p-5" onStartShouldSetResponder={() => true}>
          <Pressable onPress={onFechar} hitSlop={10} className="absolute right-3 top-2">
            <T className="text-sm text-muted">✕</T>
          </Pressable>
          <T className="text-center text-4xl">{quebrou ? "💪" : "🔥"}</T>
          <T className="mt-1 text-center font-mont-xb text-base">
            {quebrou ? "Sequência recomeçou" : `Sequência: ${dia} ${dia === 1 ? "dia" : "dias"}!`}
          </T>
          {pontos > 0 ? (
            <T className="mt-0.5 text-center font-odds text-2xl text-primary">+{pontos} PONTOS</T>
          ) : (
            <T className="mt-0.5 text-center text-sm text-muted">
              Hoje você já resgatou <T className="font-mont-b text-primary">+{CURVA[dia - 1]} pontos</T>
            </T>
          )}
          <View className="my-3 flex-row justify-between">
            {CURVA.map((v, i) => {
              const d = i + 1;
              const cls =
                d < dia || (d === dia && !quebrou) || (d === 1 && quebrou && dia === 1)
                  ? d === dia
                    ? "h-8 w-8 bg-primary text-sm"
                    : "h-6 w-6 bg-primary text-[11px]"
                  : "h-6 w-6 bg-cardAlt border border-dashed border-line text-[10px] text-muted";
              return (
                <View key={d} className="items-center">
                  <View className={`items-center justify-center rounded-full ${cls}`}>
                    <T className={cls.includes("text-muted") ? "text-[10px] text-muted" : "text-[10px] text-white font-mont-b"}>
                      {d <= dia || (quebrou && d === 1) ? "✓" : d}
                    </T>
                  </View>
                  <T className={`mt-1 text-[9px] ${d === dia ? "font-mont-b text-primary" : "text-muted"}`}>
                    {d === dia ? "hoje" : `+${v}`}
                  </T>
                </View>
              );
            })}
          </View>
          {quebrou ? (
            <T className="text-center text-xs text-muted">Dia {dia} · volta amanhã pro dia 2</T>
          ) : (
            <T className="text-center text-xs text-muted">
              Amanhã <T className="font-mont-b text-fg">+{amanha} pontos</T>{"\n"}No 7º dia: <T className="font-mont-b text-primary">+110 pontos</T> 🔥
            </T>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}
