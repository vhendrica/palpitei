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
  // Barra em R$ de 0 até a próxima faixa, preenchida até o prêmio atual. Cada palpiteiro que entra
  // anda um pouco rumo à próxima faixa; o valor do prêmio só muda quando ela é atingida.
  const prox = premio.proxima;
  const base =
    [...premio.escada].reverse().find((f) => f.usuarios_min <= palpiteiros)?.usuarios_min ?? 0;
  const frac = prox
    ? Math.min(1, Math.max(0, (palpiteiros - base) / Math.max(1, prox.usuarios_min - base)))
    : 0;
  const naBarra = premio_atual + (prox ? (prox.valor - premio_atual) * frac : 0);
  const alvo = prox?.valor ?? meta?.valor ?? 0;
  const pct = alvo ? Math.min(100, (naBarra / alvo) * 100) : 0;
  const faltam = premio.proxima?.faltam ?? faltam_meta;

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
          <BarraAnimada pct={pct} />
          <View className="mt-1 flex-row justify-between">
            <T className="font-odds text-[11px] text-gold">{fmtReais(premio_atual)}</T>
            <T className="font-odds text-[11px] text-gold">{fmtReais(alvo)}</T>
          </View>
          <View className="mt-1.5 flex-row items-center">
            {meta_atingida ? null : <Foguinho />}
            <T
              className={`flex-1 text-xs ${meta_atingida ? "text-muted" : "font-mont-b text-fg"}`}
            >
              {meta_atingida
                ? `Meta batida: prêmio de ${fmtReais(meta.valor)}`
                : `${faltam === 1 ? "Falta 1 palpiteiro" : `Faltam ${fmtPts(faltam)} palpiteiros`} para o prêmio subir para ${fmtReais(premio.proxima?.valor ?? meta.valor)}`}
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

function BarraAnimada({ pct }: { pct: number }) {
  const { palette: C } = useTheme();
  const [w] = useState(() => new Animated.Value(pct));
  useEffect(() => {
    Animated.timing(w, {
      toValue: pct,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, w]);
  return (
    <View className="mt-3 h-2.5 overflow-hidden rounded-full bg-cardAlt">
      <Animated.View
        style={{
          height: 10,
          borderRadius: 999,
          backgroundColor: C.gold,
          width: w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        }}
      />
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

/** Linha fina do prêmio no topo da home: só o troféu e o que o campeão leva. */
export function PremioLinha({
  premio,
  descricao,
  finalizada,
}: {
  premio: Premio;
  descricao?: string | null;
  finalizada?: boolean;
}) {
  const { palette: C } = useTheme();
  // Finalizada: só o prêmio real (sem a meta), em texto neutro — pode não ter havido campeão.
  const valor =
    descricao ||
    (premio.premio_atual > 0
      ? fmtReais(premio.premio_atual)
      : premio.meta && !finalizada
        ? `até ${fmtReais(premio.meta.valor)}`
        : null);
  if (!valor) return null;
  return (
    <View className="flex-row items-center rounded-xl border border-gold/40 bg-gold/10 px-3 py-2">
      <Ionicons name="trophy" size={16} color={C.gold} />
      <T className="ml-2 flex-1 text-sm" numberOfLines={1}>
        {finalizada ? "Prêmio da rodada: " : "Campeão leva "}
        <T className="font-mont-xb text-sm text-gold">{valor}</T>
      </T>
    </View>
  );
}
