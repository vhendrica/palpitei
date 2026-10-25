import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { Sheet } from "../../components/Modals";
import { Button, Card, EmptyState, StatusBadge, T } from "../../components/ui";
import { fmtOdd, fmtPts } from "../../lib/format";
import { calcularRanking, getEntrada } from "../../lib/rules";
import { useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import type { RankingRow } from "../../types";

const MEDALHA = ["#FFC83D", "#C0C0C0", "#CD7F32"];

export default function Ranking() {
  const { palette: C } = useTheme();
  const { db, user } = useApp();
  const { ligaId } = useLocalSearchParams<{ ligaId?: string }>();
  const padrao =
    (user && db.ligas.find((l) => getEntrada(db, user.id, l.id))?.id) ??
    db.ligas[0]?.id;
  const [sel, setSel] = useState<string | undefined>(ligaId ?? padrao);

  const [detalhe, setDetalhe] = useState<RankingRow | null>(null);
  const [paramAnterior, setParamAnterior] = useState(ligaId);
  if (ligaId !== paramAnterior) {
    setParamAnterior(ligaId);
    if (ligaId) setSel(ligaId);
  }

  const liga = db.ligas.find((l) => l.id === sel);
  const ranking = liga ? calcularRanking(db, liga.id) : [];
  const temResultado = db.mercados.some(
    (m) => m.liga_id === sel && m.resultado_final,
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Ranking" />
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 4, gap: 8 }}
        >
          {db.ligas.map((l) => {
            const on = l.id === sel;
            return (
              <Pressable
                key={l.id}
                onPress={() => setSel(l.id)}
                className={`rounded-full border px-4 py-2 ${on ? "border-primary bg-primary" : "border-line bg-card"}`}
              >
                <T
                  className={`font-mont-b text-xs ${on ? "text-onPrimary" : "text-fg"}`}
                >
                  {l.nome_jogo}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {liga ? (
          <View className="mb-3 flex-row items-center justify-between">
            <T className="font-mont-xb text-lg">{liga.nome_jogo}</T>
            <StatusBadge status={liga.status} />
          </View>
        ) : null}
        {liga && !temResultado ? (
          <Card className="mb-3 flex-row items-center">
            <Ionicons name="time-outline" size={18} color={C.muted} />
            <T className="ml-2 flex-1 text-xs text-fg/70">
              Os mercados ainda não têm resultado. A pontuação é calculada
              quando os mercados batem (fichas × odd).
            </T>
          </Card>
        ) : null}
        {ranking.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Ninguém entrou nesse palpite ainda"
          />
        ) : (
          <Card className="p-0">
            <View className="flex-row border-b border-line px-4 py-2.5">
              <T className="w-10 font-mont-b text-[10px] text-muted">POS</T>
              <T className="flex-1 font-mont-b text-[10px] text-muted">
                JOGADOR
              </T>
              <T className="w-12 text-right font-mont-b text-[10px] text-muted">
                FICHAS
              </T>
              <T className="w-16 text-right font-mont-b text-[10px] text-muted">
                PONTOS
              </T>
            </View>
            {ranking.map((r) => {
              const eu = r.user.id === user?.id;
              const venceu =
                liga?.status === "finalizada" &&
                r.posicao === 1 &&
                r.pontuacao > 0;
              return (
                <Pressable
                  key={r.user.id}
                  onPress={() => setDetalhe(r)}
                  className={`flex-row items-center border-b border-line/60 px-4 py-3 active:bg-cardAlt ${eu ? "bg-primary/10" : ""}`}
                >
                  <View className="w-10">
                    {r.posicao <= 3 && r.pontuacao > 0 ? (
                      <View
                        className="h-6 w-6 items-center justify-center rounded-full"
                        style={{ backgroundColor: MEDALHA[r.posicao - 1] }}
                      >
                        <T className="font-mont-xb text-xs text-black">
                          {r.posicao}
                        </T>
                      </View>
                    ) : (
                      <T className="pl-1.5 font-mont-b text-sm text-muted">
                        {r.posicao}
                      </T>
                    )}
                  </View>
                  <View className="flex-1 pr-1">
                    <T
                      className={`font-mont-b text-sm ${eu ? "text-primary" : ""}`}
                      numberOfLines={2}
                    >
                      {eu ? `${r.user.name} (você)` : r.user.name}
                      {venceu ? (
                        <>
                          {" "}
                          <Ionicons name="trophy" size={13} color={C.gold} />
                        </>
                      ) : null}
                    </T>
                    <T className="text-[11px] text-muted">{r.user.bairro}</T>
                  </View>
                  <T className="w-12 text-right font-mont-sb text-xs text-muted">
                    {r.fichas_apostadas}
                  </T>
                  <T className="w-16 text-right font-odds text-base text-primary">
                    {fmtPts(r.pontuacao)}
                  </T>
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color={C.muted}
                    style={{ marginLeft: 2 }}
                  />
                </Pressable>
              );
            })}
          </Card>
        )}
        <T className="mt-3 text-center text-[11px] text-muted">
          Pontuação = Σ (fichas apostadas × odd) dos mercados vencedores
        </T>
        <T className="mt-1 text-center text-[11px] text-muted">
          Toque em um jogador para ver as apostas dele
        </T>
      </ScrollView>
      <Sheet visible={!!detalhe} onClose={() => setDetalhe(null)}>
        {detalhe && liga ? (
          <DetalheApostas
            row={detalhe}
            ligaId={liga.id}
            finalizada={liga.status === "finalizada"}
          />
        ) : null}
        <Button
          title="Fechar"
          variant="ghost"
          className="mt-4"
          onPress={() => setDetalhe(null)}
        />
      </Sheet>
    </View>
  );
}

function DetalheApostas({
  row,
  ligaId,
  finalizada,
}: {
  row: RankingRow;
  ligaId: string;
  finalizada: boolean;
}) {
  const { db } = useApp();
  const itens = db.apostas
    .filter((a) => a.user_id === row.user.id && a.liga_id === ligaId)
    .map((a) => ({ a, m: db.mercados.find((m) => m.id === a.mercado_id) }))
    .filter((x) => x.m)
    .sort((x, y) => y.a.fichas_apostadas - x.a.fichas_apostadas);
  return (
    <View>
      <T className="font-mont-b text-[11px] uppercase tracking-widest text-muted">
        {row.posicao}º lugar
      </T>
      <T className="mt-1 font-mont-xb text-xl">{row.user.name}</T>
      <T className="text-xs text-muted">{row.user.bairro}</T>
      <View className="mt-4 flex-row border-b border-line pb-2">
        <T className="flex-1 font-mont-b text-[10px] text-muted">MERCADO</T>
        <T className="w-16 text-right font-mont-b text-[10px] text-muted">
          FICHAS
        </T>
        <T className="w-20 text-right font-mont-b text-[10px] text-muted">
          RESULTADO
        </T>
      </View>
      {itens.length === 0 ? (
        <T className="py-4 text-center text-xs text-muted">
          Ainda não distribuiu fichas neste palpite.
        </T>
      ) : (
        itens.map(({ a, m }) => {
          const bateu = m!.resultado_final;
          return (
            <View
              key={a.id}
              className="flex-row items-center border-b border-line/60 py-2.5"
            >
              <View className="flex-1 pr-2">
                <T className="font-mont-b text-xs" numberOfLines={2}>
                  {m!.descricao}
                </T>
                <T className="font-odds text-[11px] text-primary">
                  {fmtOdd(m!.multiplicador)}
                </T>
              </View>
              <T className="w-16 text-right font-mont-b text-sm">
                {a.fichas_apostadas}
              </T>
              <T
                className={`w-20 text-right font-mont-b text-[11px] ${bateu ? "text-primary" : finalizada ? "text-danger" : "text-muted"}`}
              >
                {bateu
                  ? `+${fmtPts(a.fichas_apostadas * m!.multiplicador)}`
                  : finalizada
                    ? "Não bateu"
                    : "Aguardando"}
              </T>
            </View>
          );
        })
      )}
      <View className="mt-3 flex-row justify-between">
        <T className="text-xs text-muted">
          Total: {row.fichas_apostadas} fichas
        </T>
        <T className="font-mont-xb text-sm text-primary">
          {fmtPts(row.pontuacao)} pts
        </T>
      </View>
    </View>
  );
}
