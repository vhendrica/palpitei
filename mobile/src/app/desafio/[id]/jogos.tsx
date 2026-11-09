import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import { AppHeader } from "../../../components/AppHeader";
import { BetButton } from "../../../components/BetButton";
import { Card, EmptyState, T } from "../../../components/ui";
import { GrupoTitulo } from "../../../components/GrupoTitulo";
import { api } from "../../../lib/api";
import { errorMessage } from "../../../store/AppStore";
import { agruparMercados, type DesafioDetalhe } from "../../../types";

/** Jogos do desafio com mercados e o que bateu (✓) — tela separada, aberta pelo card "Jogos ›". */
export default function JogosDesafio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<DesafioDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await api.desafios.detalhe(String(id)));
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title={d?.liga.titulo ?? "Jogos"} back />
      <ScrollView className="flex-1 px-3 py-3">
        {erro ? <EmptyState icon="cloud-offline-outline" title={erro} /> : null}
        {d?.jogos.map((j) => (
          <Card key={j.id} className="mb-2">
            <View className="flex-row items-center">
              <View className="flex-1">
                <T className="font-mont-b text-sm">
                  {j.time_casa} x {j.time_fora}
                </T>
                <T className="text-xs text-muted">{j.campeonato}</T>
              </View>
              {j.placar ? (
                <T className="font-mont-xb text-base">
                  {j.placar.casa} - {j.placar.fora}
                </T>
              ) : null}
            </View>
            <View className="mt-2">
              {agruparMercados(j.mercados).map((g) => (
                <View key={g.grupo || "_"} className="mt-2">
                  {g.grupo ? <GrupoTitulo grupo={g.grupo} /> : null}
                  <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                    {g.opcoes.map((m) => (
                      <View key={m.id} style={{ flexGrow: 1, flexBasis: "30%", minWidth: 0 }}>
                        <BetButton
                          compact
                          descricao={m.descricao}
                          multiplicador={m.multiplicador}
                          selected={false}
                          fichas={m.minhas_fichas ?? 0}
                          resultado={
                            j.finalizado || m.decidido
                              ? m.resultado_final
                                ? "green"
                                : (m.minhas_fichas ?? 0) > 0
                                  ? "red"
                                  : null
                              : null
                          }
                          disabled
                          onPress={() => {}}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
