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
import type { LigaStatus, PalpiteiroView } from "../../types";

/** Admin: todos os palpiteiros (e bilhetes) de uma liga — inclui desafios. */
export default function AdminPalpiteiros() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette: C } = useTheme();
  const [liga, setLiga] = useState<{ id: string; status: LigaStatus } | null>(null);
  const [lista, setLista] = useState<PalpiteiroView[] | null>(null);
  const [data, setData] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Set<number>>(new Set());

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await api.admin.palpiteiros(String(id));
        if (!ativo) return;
        setLista(r.palpiteiros);
        setLiga((r.liga as { id: string; status: LigaStatus } | null) ?? null);
        setData(r.data);
        setErro(null);
      } catch (e) {
        if (!ativo) return;
        setErro(errorMessage(e));
        setLista([]);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [id]);

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Palpiteiros" back />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <ErrorBox erro={erro} />
        {liga ? (
          <View className="mb-2 flex-row items-center">
            <StatusBadge status={liga.status} />
            <T className="ml-2 text-xs text-muted">
              {data ? fmtData(data) : ""} · {lista?.length ?? 0} palpiteiro
              {lista?.length === 1 ? "" : "s"}
            </T>
          </View>
        ) : null}
        {lista && lista.length === 0 ? (
          <EmptyState icon="people-outline" title="Ninguém entrou nessa rodada" />
        ) : null}
        {lista?.map((p, i) => {
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
              <Card className="mb-2">
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
                  <Ionicons
                    name={ab ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={C.muted}
                  />
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