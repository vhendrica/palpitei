import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { ErrorBox } from "../../components/Form";
import { PalpiteiroBilhete } from "../../components/PalpiteiroBilhete";
import { Card, EmptyState, StatusBadge, T } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtData, fmtPontos } from "../../lib/format";
import { errorMessage } from "../../store/AppStore";
import type { MeuBilhete } from "../../types";

/** Histórico: o bilhete completo da rodada/desafio em que o usuário participou. */
export default function HistoricoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<MeuBilhete | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
      <AppHeader title="Meu bilhete" back />
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
                {d.minha.posicao ? `${d.minha.posicao}º lugar · ` : ""}
                {fmtPontos(d.minha.pontuacao)} pts · {d.minha.acertos}{" "}
                {d.minha.acertos === 1 ? "acerto" : "acertos"}
              </T>
            ) : null}
          </Card>
        ) : null}
        {d && !d.minha ? (
          <EmptyState icon="receipt-outline" title="Bilhete não encontrado" />
        ) : null}
        {d?.minha ? (
          <Card>
            <PalpiteiroBilhete p={d.minha} />
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}