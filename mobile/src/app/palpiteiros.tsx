import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppHeader } from "../components/AppHeader";
import { Ficha } from "../components/Ficha";
import { ErrorBox } from "../components/Form";
import { Card, EmptyState, Esqueleto, T } from "../components/ui";
import { api } from "../lib/api";
import { corMultipla } from "../lib/bilhete";
import { useDesktop } from "../lib/desktop";
import { fmtOdd, fmtPontos, rotuloPalpite } from "../lib/format";
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
  const [aberto, setAberto] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const desktop = useDesktop();

  const load = useCallback(async () => {
    try {
      const next = (await api.palpiteiros(true)).palpiteiros;
      // Polling de 15s: só re-renderiza quando algo realmente mudou —
      // evita o "refresh do nada" a cada ciclo e o card aberto pular de pessoa.
      setRows((prev) =>
        prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
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
        <View style={desktop ? { maxWidth: 980, width: "100%", alignSelf: "center" } : undefined}>
        <ErrorBox erro={erro} />
        {rows === null && !erro ? <Esqueleto /> : null}
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
          // Antes de pontuar, o potencial é o número principal do ranking.
          const semPontos = rows.every((o) => o.pontuacao === 0);
          return (
            <Card
              key={p.entrou_em}
              className={`mb-2 ${p.eu ? "border-2 border-primary" : ""}`}
            >
              <Pressable
                className="flex-row items-center"
                onPress={() => setAberto(aberto === p.entrou_em ? null : p.entrou_em)}
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-cardAlt">
                  <T className="font-mont-xb text-sm">{p.posicao ? `${p.posicao}º` : "—"}</T>
                </View>
                <View className="ml-3 flex-1">
                  <T className="font-mont-b text-sm">
                    {p.nome}
                    {p.eu ? " (você)" : ""}
                  </T>
                </View>
                {semPontos ? (
                  <View className="mr-2 items-end">
                    <T className="font-odds text-base text-primary">{fmtPontos(p.potencial ?? 0)} pts</T>
                    <T className="text-[10px] text-muted">potencial</T>
                  </View>
                ) : (
                  <T className="mr-2 font-odds text-base text-primary">{fmtPontos(p.pontuacao)} pts</T>
                )}
                <Ionicons
                  name={aberto === p.entrou_em ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={C.muted}
                />
              </Pressable>
              {aberto === p.entrou_em ? (
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
                      {p.potencial_simples ? (
                        <T className="mt-1.5 text-right text-[11px] text-muted">
                          Simples pode render até{" "}
                          <T className="font-mont-xb text-[11px] text-primary">{fmtPontos(p.potencial_simples)} pts</T>
                        </T>
                      ) : null}
                    </View>
                  ) : null}
                  {p.multiplas.map((m) => {
                    const cor = corMultipla(m.numero - 1, scheme);
                    const pot = m.potencial ?? (m.fichas != null && m.odd != null ? m.fichas * m.odd : null);
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
                            {m.odd != null ? <T className="text-xs text-muted">multiplicador {fmtOdd(m.odd)}</T> : null}
                            {m.fichas != null ? (
                              <View className="ml-2 flex-row items-center rounded-md border border-line px-1">
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
                        {pot ? (
                          <T className="text-right text-[11px] text-muted">
                            se todas baterem →{" "}
                            <T className="font-mont-xb text-[11px] text-primary">{fmtPontos(pot)} pts</T>
                          </T>
                        ) : null}
                        {m.ocultas > 0 ? (
                          <T className="text-[11px] text-muted">
                            + {m.ocultas} {m.ocultas === 1 ? "palpite" : "palpites"} de jogos que ainda não começaram
                          </T>
                        ) : null}
                      </View>
                    );
                  })}
                  {(() => {
                    // Só quando há empate em pontos (acima de 0) com outro palpiteiro.
                    const empatados = (rows ?? []).filter((o) => o !== p && p.pontuacao > 0 && o.pontuacao === p.pontuacao);
                    if (!empatados.length) return null;
                    const naOdd = empatados.some((o) => (o.maior_acerto ?? 0) === (p.maior_acerto ?? 0));
                    return (
                      <>
                        <CaixaDesempate
                          titulo="Critério de desempate: odd maior"
                          valor={p.maior_acerto ? fmtOdd(p.maior_acerto) : "—"}
                        />
                        {naOdd ? (
                          <CaixaDesempate
                            titulo="Critério de desempate 2: maior número de acertos"
                            valor={`${p.acertos ?? 0} ${p.acertos === 1 ? "acerto" : "acertos"}`}
                          />
                        ) : null}
                      </>
                    );
                  })()}
                  {p.potencial != null ? (
                    <View className="mt-2 flex-row items-center justify-between border-t border-line pt-2">
                      <T className="font-mont-b text-xs text-muted">Potencial máximo</T>
                      <T className="font-odds text-lg text-primary">{fmtPontos(p.potencial)} pts</T>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })}
        </View>
      </ScrollView>
    </View>
  );
}

function CaixaDesempate({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View className="mt-2 flex-row items-center justify-between rounded-lg border border-gold/40 bg-gold/10 px-2 py-1.5">
      <T className="flex-1 pr-2 font-mont-b text-[11px]">{titulo}</T>
      <T className="font-odds text-sm text-gold">{valor}</T>
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
        <View className="ml-2 items-end">
          <View className="flex-row items-center rounded-md border border-line px-1">
            <T className="mr-0.5 font-odds text-xs">{fichas}</T>
            <Ficha size={12} />
          </View>
          <T className="text-[10px] text-muted">→ {fmtPontos(resultado === "red" ? 0 : fichas * odd)} pts</T>
        </View>
      ) : null}
    </View>
  );
}
