import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { ErrorBox } from "../../components/Form";
import { HistoricoLinha } from "../../components/HistoricoLinha";
import { Card, EmptyState } from "../../components/ui";
import { api } from "../../lib/api";
import { useDesktop } from "../../lib/desktop";
import { errorMessage } from "../../store/AppStore";
import type { HistoricoItem } from "../../types";

/** Histórico completo: todas as rodadas, desafios e duelos em que o usuário entrou. */
export default function Historico() {
  const [rows, setRows] = useState<HistoricoItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const desktop = useDesktop();

  useFocusEffect(
    useCallback(() => {
      api
        .historico()
        .then((r) => {
          setRows(r.historico);
          setErro(null);
        })
        .catch((e) => setErro(errorMessage(e)));
    }, []),
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Histórico" back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={desktop ? { maxWidth: 720, width: "100%", alignSelf: "center" } : undefined}>
          <ErrorBox erro={erro} />
          {rows && rows.length === 0 ? (
            <EmptyState icon="time-outline" title="Você ainda não palpitou" />
          ) : null}
          {rows && rows.length > 0 ? (
            <Card>
              {rows.map((h, i) => (
                <HistoricoLinha key={h.liga_id} h={h} primeira={i === 0} />
              ))}
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
