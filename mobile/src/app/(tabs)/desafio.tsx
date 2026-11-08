import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, router } from "expo-router";
import { useCallback, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { ErrorBox } from "../../components/Form";
import { Button, Card, EmptyState, StatusBadge, T } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtData } from "../../lib/format";
import { errorMessage, useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import type { DesafioResumo } from "../../types";

/** Aba Desafio: os que eu criei/entrei + os públicos abertos. */
export default function Desafios() {
  const { user } = useApp();
  const { palette: C } = useTheme();
  const [meus, setMeus] = useState<DesafioResumo[] | null>(null);
  const [publicos, setPublicos] = useState<DesafioResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalCriar, setModalCriar] = useState(false);

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
          <View className="flex-row items-center">
            <T className="font-mont-b text-sm" style={{ flexShrink: 1 }} numberOfLines={1}>
              {d.titulo ?? `Desafio de ${d.dono}`}
            </T>
            {d.modo === "duelo" ? (
              <View className="ml-2 rounded-full bg-cardAlt px-2 py-0.5">
                <T className="text-[10px] text-muted">DUELO</T>
              </View>
            ) : null}
          </View>
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
          onPress={() => setModalCriar(true)}
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
      <Modal transparent visible={modalCriar} animationType="fade" onRequestClose={() => setModalCriar(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}
          onPress={() => setModalCriar(false)}
        >
          <View className="rounded-2xl bg-card p-4">
            <T className="mb-3 text-center font-mont-xb text-base">Criar desafio</T>
            {(
              [
                {
                  key: "grupo",
                  icon: "people-circle-outline" as const,
                  titulo: "Em grupo",
                  texto: "Vários amigos disputam o ranking. Pode ser público pra qualquer um ou só por link.",
                },
                {
                  key: "duelo",
                  icon: "people-outline" as const,
                  titulo: "Duelo",
                  texto: "Só você e mais 1. Sempre privado — o link entra só a primeira pessoa que abrir.",
                },
              ]
            ).map((m) => (
              <Pressable
                key={m.key}
                className="mb-2 flex-row items-center rounded-xl border border-line bg-cardAlt p-3"
                onPress={() => {
                  setModalCriar(false);
                  router.push(`/desafio/criar?modo=${m.key}`);
                }}
              >
                <Ionicons name={m.icon} size={30} color={C.muted} />
                <View className="ml-3 flex-1">
                  <T className="font-mont-xb text-sm">{m.titulo}</T>
                  <T className="mt-0.5 text-[11px] text-muted">{m.texto}</T>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
