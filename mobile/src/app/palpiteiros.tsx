import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppHeader } from "../components/AppHeader";
import { Ficha } from "../components/Ficha";
import { ErrorBox } from "../components/Form";
import { Card, EmptyState, T } from "../components/ui";
import { api } from "../lib/api";
import { corMultipla } from "../lib/bilhete";
import { fmtOdd, fmtPts, rotuloPalpite } from "../lib/format";
import { errorMessage } from "../store/AppStore";
import { useTheme } from "../store/Theme";
import type { PalpiteiroView, Resultado } from "../types";

export default function Palpiteiros() {
  return <RankingDoDia voltar />;
}

/** Ranking do dia: posição e pontos de cada palpiteiro; tocar no nome abre o bilhete. */
export function RankingDoDia({ voltar }: { voltar?: boolean }) {
  const { palette: C, scheme } = useTheme();
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
      <AppHeader title="Ranking do dia" back={voltar} />
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
            {rows.length === 1 ? "palpiteiro" : "palpiteiros"} na rodada. Toque
            no nome pra ver o bilhete.
          </T>
        ) : null}
        {rows?.map((p, i) => {
          const nada = p.palpites.length === 0 && p.multiplas.length === 0;
          return (
            <Card
              key={i}
              className={`mb-2 ${p.eu ? "border-2 border-primary" : ""}`}
            >
              <Pressable
                className="flex-row items-center"
                onPress={() => setAberto(aberto === i ? null : i)}
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-cardAlt">
                  <T className="font-mont-xb text-sm">{p.posicao ? `${p.posicao}º` : "—"}</T>
                </View>
                <T className="ml-3 flex-1 font-mont-b text-sm">
                  {p.nome}
                  {p.eu ? " (você)" : ""}
                </T>
                <T className="mr-2 font-odds text-base text-primary">{fmtPts(p.pontuacao)} pts</T>
                <Ionicons
                  name={aberto === i ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={C.muted}
                />
              </Pressable>
              {aberto === i ? (
                <View className="mt-3">
                  {nada ? (
                    <T className="text-xs text-muted">
                      {p.eu
                        ? "Você ainda não distribuiu fichas."
                        : "Os palpites aparecem quando os jogos começarem."}
                    </T>
                  ) : null}
                  {p.palpites.length > 0 ? (
                    <View className="rounded-lg border-2 border-dashed border-primary px-2 py-1.5">
                      <T className="font-mont-xb text-xs" style={{ color: C.primary }}>
                        Simples
                      </T>
                      {p.palpites.map((x, k) => (
                        <Linha
                          key={k}
                          rotulo={rotuloPalpite(x.grupo, x.descricao)}
                          jogo={x.jogo}
                          odd={x.multiplicador}
                          resultado={x.resultado}
                          fichas={x.fichas}
                        />
                      ))}
                    </View>
                  ) : null}
                  {p.multiplas.map((m) => {
                    const cor = corMultipla(m.numero - 1, scheme);
                    return (
                      <View
                        key={m.numero}
                        className="mt-2 rounded-lg px-2 py-1.5"
                        style={{ borderWidth: 1.5, borderColor: cor }}
                      >
                        <View className="flex-row items-center justify-between">
                          <T className="font-mont-xb text-xs" style={{ color: cor }}>
                            Múltipla {m.numero}
                          </T>
                          <View className="flex-row items-center">
                            <T className="text-xs text-muted">odd {fmtOdd(m.odd)}</T>
                            {m.fichas != null ? (
                              <View className="ml-2 flex-row items-center">
                                <T className="mr-0.5 font-odds text-xs">{m.fichas}</T>
                                <Ficha size={12} />
                              </View>
                            ) : null}
                          </View>
                        </View>
                        {m.pernas.map((x, n) => (
                          <Linha
                            key={n}
                            rotulo={rotuloPalpite(x.grupo, x.descricao)}
                            jogo={x.jogo}
                            odd={x.odd}
                            resultado={x.resultado}
                          />
                        ))}
                        {m.ocultas > 0 ? (
                          <T className="text-[11px] text-muted">
                            + {m.ocultas} {m.ocultas === 1 ? "palpite" : "palpites"} de jogos que ainda não começaram
                          </T>
                        ) : null}
                      </View>
                    );
                  })}
                  {p.potencial != null ? (
                    <View className="mt-2 flex-row items-center justify-between border-t border-line pt-2">
                      <T className="font-mont-b text-xs text-muted">Potencial máximo</T>
                      <T className="font-odds text-lg text-primary">{fmtPts(p.potencial)} pts</T>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Linha({
  rotulo,
  jogo,
  odd,
  resultado,
  fichas,
}: {
  rotulo: string;
  jogo: string;
  odd: number;
  resultado: Resultado;
  fichas?: number;
}) {
  const { palette: C } = useTheme();
  return (
    <View className="flex-row items-center py-1.5">
      {resultado ? (
        <Ionicons
          name={resultado === "green" ? "checkmark-circle" : "close-circle"}
          size={16}
          color={resultado === "green" ? C.primary : C.danger}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <View className="flex-1 pr-2">
        <T className="font-mont-b text-sm">{rotulo}</T>
        <T className="text-xs text-muted">{jogo}</T>
      </View>
      <T className="font-odds text-base text-primary">{fmtOdd(odd)}</T>
      {fichas != null ? (
        <View className="ml-2 flex-row items-center">
          <T className="mr-0.5 font-odds text-xs">{fichas}</T>
          <Ficha size={12} />
        </View>
      ) : null}
    </View>
  );
}
