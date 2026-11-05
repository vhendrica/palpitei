import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { ErrorBox } from "../../components/Form";
import { PalpiteiroBilhete } from "../../components/PalpiteiroBilhete";
import { Card, EmptyState, StatusBadge, T } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtData, fmtPontos } from "../../lib/format";
import { errorMessage } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import type { MeuBilhete } from "../../types";

/** Histórico: rank inteiro da rodada/desafio em que o usuário participou (bilhetes expansíveis). */
export default function HistoricoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette: C } = useTheme();
  const [d, setD] = useState<MeuBilhete | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Set<number>>(new Set());

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await api.meuBilhete(String(id));
        if (!ativo) return;
        setD(r);
        setErro(null);
      } catch (e) {
        if (!ativo) return;
        setErro(errorMessage(e));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [id]);

  const liga = d?.liga;
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Histórico" back />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <ErrorBox erro={erro} />
        {liga ? (
          <Card className="mb-3">
            <View className="flex-row items-center">
              <View className="flex-1">
                <T className="font-mont-xb text-base">
                  {liga.desafio ? (liga.titulo ?? "Desafio") : "Rodada oficial"}
                </T>
                <T className="text-xs text-muted">
                  {fmtData(liga.data)}
                  {liga.dono ? ` · de ${liga.dono}` : ""}
                </T>
              </View>
              <StatusBadge status={liga.status} />
            </View>
            {d?.minha ? (
              <T className="mt-2 text-sm">
                você: {d.minha.posicao ? `${d.minha.posicao}º lugar · ` : ""}
                {fmtPontos(d.minha.pontuacao)} pts · {d.minha.acertos}{" "}
                {d.minha.acertos === 1 ? "acerto" : "acertos"}
              </T>
            ) : null}
          </Card>
        ) : null}
        {d && d.palpiteiros.length === 0 ? (
          <EmptyState icon="people-outline" title="Ninguém palpitou" />
        ) : null}
        {d?.palpiteiros.map((p, i) => {
          const ab = aberto.has(i);
          return (
            <Pressable
              key={i}
              onPress={() =>
                setAberto((s) => {
                  const n = new Set(s);
                  if (n.has(i)) n.delete(i);
                  else n.add(i);
                  return n;
                })
              }
            >
              <Card className={`mb-2 ${p.eu ? "border border-primary" : ""}`}>
                <View className="flex-row items-center">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-cardAlt">
                    <T className="font-mont-xb text-xs">{p.posicao ?? "-"}º</T>
                  </View>
                  <View className="ml-3 flex-1">
                    <T className="font-mont-b text-sm">
                      {p.nome}
                      {p.eu ? " (você)" : ""}
                    </T>
                    <T className="text-xs text-muted">
                      {fmtPontos(p.pontuacao)} pts · {p.acertos}{" "}
                      {p.acertos === 1 ? "acerto" : "acertos"}
                      {p.desempate ? ` · ${p.desempate}` : ""}
                    </T>
                  </View>
                  <Ionicons name={ab ? "chevron-up" : "chevron-down"} size={16} color={C.muted} />
                </View>
                {ab ? (
                  <View className="mt-2 border-t border-line pt-2">
                    {p.palpites.length === 0 && p.multiplas.length === 0 ? (
                      <T className="text-xs text-muted">Sem palpites ainda.</T>
                    ) : (
                      <PalpiteiroBilhete p={p} />
                    )}
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}