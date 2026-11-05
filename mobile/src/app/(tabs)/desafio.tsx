import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { ErrorBox } from "../../components/Form";
import { Button, Card, EmptyState, StatusBadge, T } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtData } from "../../lib/format";
import { errorMessage, useApp } from "../../store/AppStore";
import type { DesafioResumo } from "../../types";

/** Aba Desafio: os que eu criei/entrei + os públicos abertos. */
export default function Desafios() {
  const { user } = useApp();
  const [meus, setMeus] = useState<DesafioResumo[] | null>(null);
  const [publicos, setPublicos] = useState<DesafioResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setMeus([]);
      setPublicos([]);
      return;
    }
    try {
      const r = await api.desafios.listar();
      setMeus(r.meus);
      setPublicos(r.publicos);
      setErro(null);
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, [user]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!user) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Desafio" />
        <View className="flex-1 items-center justify-center px-8">
          <T className="mb-4 text-center text-muted">
            Entre na sua conta pra criar um desafio e chamar os amigos.
          </T>
          <Button title="Entrar" onPress={() => router.push("/entrar")} />
        </View>
      </View>
    );
  }

  const item = (d: DesafioResumo) => (
    <Pressable key={d.id} onPress={() => router.push(`/desafio/${d.id}`)}>
      <Card className="mb-2 flex-row items-center">
        <View className="flex-1">
          <T className="font-mont-b text-sm">{d.titulo ?? `Desafio de ${d.dono}`}</T>
          <T className="text-xs text-muted">
            {d.e_dono ? "você criou" : `de ${d.dono}`} · {d.jogos}{" "}
            {d.jogos === 1 ? "jogo" : "jogos"} · {d.palpiteiros}{" "}
            {d.palpiteiros === 1 ? "palpiteiro" : "palpiteiros"} · {fmtData(d.data)}
          </T>
        </View>
        <StatusBadge status={d.status} />
        <Ionicons name="chevron-forward" size={18} color="#888" style={{ marginLeft: 6 }} />
      </Card>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Desafio" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <ErrorBox erro={erro} />
        <Button
          title="Criar desafio"
          icon="add"
          onPress={() => router.push("/desafio/criar")}
          className="mb-4"
        />
        {meus && meus.length === 0 && publicos.length === 0 ? (
          <EmptyState
            icon="medal-outline"
            title="Nenhum desafio ainda"
            subtitle="Crie o seu e mande o link pra galera entrar!"
          />
        ) : null}
        {meus && meus.length > 0 ? (
          <>
            <T className="mb-2 font-mont-xb text-xs uppercase text-muted">Seus desafios</T>
            {meus.map(item)}
          </>
        ) : null}
        {publicos.length > 0 ? (
          <>
            <T className="mb-2 mt-4 font-mont-xb text-xs uppercase text-muted">
              Desafios públicos
            </T>
            {publicos.map(item)}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
