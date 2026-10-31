import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { ErrorBox } from "../../components/Form";
import { Card, EmptyState, T } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtPts } from "../../lib/format";
import { errorMessage } from "../../store/AppStore";
import type { RankingRow } from "../../types";

export default function Ranking() {
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [semLiga, setSemLiga] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.ranking();
      setSemLiga(!r.liga);
      setRows(r.ranking);
      setErro(null);
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 15000);
      return () => clearInterval(t);
    }, [load]),
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Ranking do dia" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
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
        {semLiga ? (
          <EmptyState icon="trophy-outline" title="Nenhuma múltipla aberta agora" />
        ) : rows && rows.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Ninguém entrou ainda"
            subtitle="Seja o primeiro palpiteiro do dia."
          />
        ) : (
          rows?.map((r) => (
            <Card
              key={`${r.posicao}-${r.nome}`}
              className={`mb-2 flex-row items-center ${r.eu ? "border-2 border-primary" : ""}`}
            >
              <T
                className={`w-10 font-odds text-xl ${r.posicao <= 3 ? "text-gold" : "text-muted"}`}
              >
                {r.posicao}º
              </T>
              <View className="flex-1">
                <T className="font-mont-b text-sm">
                  {r.nome}
                  {r.eu ? " (você)" : ""}
                </T>
                <T className="text-xs text-muted">{r.bairro}</T>
              </View>
              <View className="items-end">
                <T className="font-odds text-lg text-primary">
                  {fmtPts(r.pontuacao)}
                </T>
                <T className="text-[10px] text-muted">pts</T>
              </View>
            </Card>
          ))
        )}
        <T className="mt-3 text-center text-[11px] text-muted">
          Desempate: quem palpitou primeiro; persistindo, quem criou a conta
          antes.
        </T>
      </ScrollView>
    </View>
  );
}
