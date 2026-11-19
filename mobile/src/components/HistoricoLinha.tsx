import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { fmtPts } from "../lib/format";
import type { HistoricoItem } from "../types";
import { T } from "./ui";

const fmtDia = (d: string) => d.slice(5).split("-").reverse().join("/");

/** Uma participação (rodada oficial, desafio ou duelo): posição, nome, contexto e pontos. */
export function HistoricoLinha({ h, primeira }: { h: HistoricoItem; primeira?: boolean }) {
  const fechada = h.status === "finalizada";
  const venceu = fechada && h.posicao === 1 && h.pontuacao > 0;
  const duelo = h.modo === "duelo";
  const titulo = !h.desafio
    ? `Rodada de ${fmtDia(h.data)}`
    : duelo
      ? h.adversario
        ? `Duelo com ${h.adversario}`
        : (h.titulo ?? "Duelo")
      : (h.titulo ?? `Desafio de ${h.dono ?? "amigos"}`);
  const resultadoDuelo =
    duelo && fechada && h.palpiteiros === 2
      ? venceu
        ? "venceu"
        : h.posicao === 2 && h.pontuacao_lider > 0
          ? "perdeu"
          : "empate"
      : null;
  const contexto = !h.desafio
    ? `oficial · ${h.palpiteiros} ${h.palpiteiros === 1 ? "palpiteiro" : "palpiteiros"}`
    : resultadoDuelo
      ? `${fmtDia(h.data)} · ${resultadoDuelo}`
      : `${fmtDia(h.data)} · ${h.palpiteiros} ${h.palpiteiros === 1 ? "palpiteiro" : "palpiteiros"}`;
  const selo = h.status === "em_andamento" ? "AO VIVO" : h.status === "aberta" ? "ABERTA" : duelo ? "DUELO" : null;
  return (
    <Pressable
      onPress={() => router.push(`/historico/${h.liga_id}`)}
      className={`flex-row items-center py-2.5 ${primeira ? "" : "border-t border-line"}`}
    >
      <View className={`h-9 w-9 items-center justify-center rounded-full ${venceu ? "bg-gold/15" : "bg-cardAlt"}`}>
        <T className={`font-mont-xb text-[11px] ${venceu ? "text-gold" : ""}`}>{h.posicao ? `${h.posicao}º` : "—"}</T>
      </View>
      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          <T className="shrink font-mont-b text-sm" numberOfLines={1}>
            {titulo}
          </T>
          {selo ? (
            <View
              className={`ml-1.5 rounded border px-1 py-0.5 ${h.status === "em_andamento" ? "border-primary/40" : "border-line"}`}
            >
              <T
                className={`font-mont-xb text-[9px] tracking-wide ${h.status === "em_andamento" ? "text-primary" : "text-muted"}`}
              >
                {selo}
              </T>
            </View>
          ) : null}
        </View>
        <T className="text-[11px] text-muted">{contexto}</T>
      </View>
      <View className="ml-2 items-end">
        <T className={`font-odds text-sm ${h.pontuacao > 0 ? "text-primary" : "text-muted"}`}>{fmtPts(h.pontuacao)}</T>
        <T className="text-[10px] text-muted">pontos</T>
      </View>
    </Pressable>
  );
}
