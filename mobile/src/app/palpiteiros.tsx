import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppHeader } from "../components/AppHeader";
import { Ficha } from "../components/Ficha";
import { ErrorBox } from "../components/Form";
import { Card, EmptyState, T } from "../components/ui";
import { api } from "../lib/api";
import { fmtOddExata, fmtPts } from "../lib/format";
import { errorMessage } from "../store/AppStore";
import { useTheme } from "../store/Theme";
import type { PalpiteiroView } from "../types";

export default function Palpiteiros() {
  const { palette: C } = useTheme();
  const [rows, setRows] = useState<PalpiteiroView[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows((await api.palpiteiros()).palpiteiros);
      setErro(null);
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Palpiteiros" back />
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
        {rows && rows.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Ninguém entrou ainda"
            subtitle="Seja o primeiro a palpitar!"
          />
        ) : null}
        {rows && rows.length > 0 ? (
          <T className="mb-3 text-sm text-muted">
            {rows.length}{" "}
            {rows.length === 1 ? "pessoa entrou" : "pessoas entraram"} na
            múltipla. Toque no nome pra ver o bilhete.
          </T>
        ) : null}
        {rows?.map((p, i) => (
          <Card
            key={i}
            className={`mb-2 ${p.eu ? "border-2 border-primary" : ""}`}
          >
            <Pressable
              className="flex-row items-center"
              onPress={() => setAberto(aberto === i ? null : i)}
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-cardAlt">
                <T className="font-mont-xb text-sm">{p.nome.slice(0, 1)}</T>
              </View>
              <View className="ml-3 flex-1">
                <T className="font-mont-b text-sm">
                  {p.nome}
                  {p.eu ? " (você)" : ""}
                </T>
                <T className="text-xs text-muted">{p.bairro}</T>
              </View>
              <T className="font-odds text-base">
                {fmtPts(p.fichas_apostadas)}
              </T>
              <View className="ml-1 mr-2">
                <Ficha size={16} />
              </View>
              <Ionicons
                name={aberto === i ? "chevron-up" : "chevron-down"}
                size={18}
                color={C.muted}
              />
            </Pressable>
            {aberto === i ? (
              <View className="mt-3 rounded-xl border-2 border-dashed border-primary p-3">
                <View className="mb-1 flex-row items-center justify-between">
                  <T className="font-mont-xb text-sm">
                    Bilhete de {p.nome.split(" ")[0]}
                  </T>
                  <View className="flex-row items-center">
                    <T className="mr-1 font-odds text-base">
                      {fmtPts(p.fichas_apostadas)}
                    </T>
                    <Ficha size={14} />
                  </View>
                </View>
                {p.multiplas?.map((m, k) => (
                  <View key={`m${k}`} className="mt-1 rounded-lg border border-line px-2 py-1.5">
                    <View className="flex-row items-center justify-between">
                      <T className="font-mont-xb text-xs">Múltipla {k + 1}</T>
                      <View className="flex-row items-center">
                        <T className="mr-1 font-odds text-sm text-primary">{m.fichas}</T>
                        <Ficha size={12} />
                      </View>
                    </View>
                    {m.pernas.map((x, n) => (
                      <T key={n} className="text-xs text-muted">
                        {x.descricao} · {x.jogo} · {x.odd.toFixed(2)}
                      </T>
                    ))}
                    <T className="text-xs">odd total {fmtOddExata(m.odd)}</T>
                  </View>
                ))}
                {p.palpites.length === 0 && !p.multiplas?.length ? (
                  <T className="text-xs text-muted">
                    Ainda não distribuiu fichas.
                  </T>
                ) : (
                  p.palpites.map((x, k) => (
                    <View key={k} className="flex-row items-center py-1.5">
                      <View className="flex-1 pr-2">
                        <T className="font-mont-b text-sm">
                          {x.grupo ? `${x.grupo}: ` : ""}
                          {x.descricao}
                        </T>
                        <T className="text-xs text-muted">
                          {x.jogo} • odd {x.multiplicador.toFixed(2)}
                        </T>
                      </View>
                      <T className="font-odds text-base text-primary">
                        {x.fichas}
                      </T>
                      <View className="ml-1">
                        <Ficha size={14} />
                      </View>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
