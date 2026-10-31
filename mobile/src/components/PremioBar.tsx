import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";

import { fmtPts } from "../lib/format";
import { useTheme } from "../store/Theme";
import type { Premio } from "../types";
import { T } from "./ui";

export const fmtReais = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Barra do prêmio: conta só quem entrou no palpite do dia; a última faixa da escada é a meta/teto. */
export function PremioBar({
  premio,
  finalizada,
  descricao,
  onPalpiteiros,
  semContagem,
  onConvidar,
}: {
  premio: Premio;
  finalizada?: boolean;
  descricao?: string | null;
  onPalpiteiros?: () => void;
  semContagem?: boolean;
  onConvidar?: () => void;
}) {
  const { palette: C } = useTheme();
  const { meta, palpiteiros, premio_atual, meta_atingida, faltam_meta } =
    premio;
  const alvo = premio.proxima?.usuarios_min ?? meta?.usuarios_min ?? 0;
  const pct = alvo ? Math.min(100, Math.round((palpiteiros / alvo) * 100)) : 0;

  return (
    <View className="rounded-2xl border border-gold/40 bg-card p-4">
      <View className="flex-row items-center">
        <Ionicons name="trophy" size={22} color={C.gold} />
        <View className="ml-2.5 flex-1">
          <T className="font-mont-b text-[10px] uppercase tracking-widest text-muted">
            {finalizada ? "Prêmio final" : "Prêmio do campeão"}
          </T>
          {descricao ? (
            <T className="font-mont-xb text-lg text-gold">{descricao}</T>
          ) : null}
          {premio_atual > 0 || !descricao ? (
            <T className="font-odds text-2xl text-gold">
              {premio_atual > 0 ? fmtReais(premio_atual) : "—"}
            </T>
          ) : null}
        </View>
        {semContagem ? null : (
          <Pressable
            className="items-end active:opacity-70"
            onPress={onPalpiteiros}
            disabled={!onPalpiteiros}
          >
            <T className="font-odds text-xl">{fmtPts(palpiteiros)}</T>
            <T className="text-[10px] uppercase tracking-widest text-muted">
              palpiteiros{onPalpiteiros ? " ›" : ""}
            </T>
          </Pressable>
        )}
      </View>

      {meta && !finalizada ? (
        <>
          <View className="mt-3 h-2 overflow-hidden rounded-full bg-cardAlt">
            <View
              className="h-2 rounded-full bg-gold"
              style={{ width: `${pct}%` }}
            />
          </View>
          <View className="mt-1.5 flex-row items-center">
            {meta_atingida ? null : <Foguinho />}
            <T
              className={`flex-1 text-xs ${meta_atingida ? "text-muted" : "font-mont-b text-fg"}`}
            >
              {meta_atingida
                ? `Meta batida: prêmio de ${fmtReais(meta.valor)}`
                : premio.proxima
                  ? `Faltam ${premio.proxima.faltam} ${premio.proxima.faltam === 1 ? "palpiteiro" : "palpiteiros"} pro prêmio de ${fmtReais(premio.proxima.valor)}`
                  : `Faltam ${faltam_meta} palpiteiros pro prêmio de ${fmtReais(meta.valor)}`}
            </T>
          </View>
        </>
      ) : null}
      {onConvidar && !finalizada ? (
        <Pressable
          onPress={onConvidar}
          className="mt-3 flex-row items-center justify-center rounded-lg border border-primary py-2 active:opacity-70"
        >
          <Ionicons name="logo-whatsapp" size={16} color={C.primary} />
          <T className="ml-1.5 font-mont-b text-xs uppercase tracking-widest text-primary">
            Convidar amigos
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

function Foguinho() {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 450,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 450,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.15],
  });
  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-6deg", "6deg"],
  });
  return (
    <Animated.View
      style={{ marginRight: 6, transform: [{ scale }, { rotate }] }}
    >
      <Ionicons name="flame" size={16} color="#FF6A00" />
    </Animated.View>
  );
}
