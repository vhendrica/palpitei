import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewInstance,
} from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { BetButton } from "../../components/BetButton";
import { Bilhete, type ItemBilhete } from "../../components/Bilhete";
import { ErrorBox } from "../../components/Form";
import { Ficha } from "../../components/Ficha";
import { PremioBar } from "../../components/PremioBar";
import { useToast } from "../../components/Toast";
import {
  Button,
  Card,
  EmptyState,
  SectionTitle,
  StatusBadge,
  T,
} from "../../components/ui";
import { fmtData, fmtPts } from "../../lib/format";
import { errorMessage, useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import { agruparMercados } from "../../types";
import type { Jogo } from "../../types";

export default function HomeMultipla() {
  const { palette: C } = useTheme();
  const { home, homeErro, refreshHome, user, entrarNaLiga, apostar } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const draftKey = `${home?.liga?.id}:${user?.id}`;
  const [draftState, setDraftState] = useState<{
    key: string;
    v: Record<string, number>;
  }>({ key: "", v: {} });
  const draft = useMemo(
    () => (draftState.key === draftKey ? draftState.v : {}),
    [draftState, draftKey],
  );
  const setDraft = (
    fn:
      | Record<string, number>
      | ((d: Record<string, number>) => Record<string, number>),
  ) =>
    setDraftState({
      key: draftKey,
      v: typeof fn === "function" ? fn(draft) : fn,
    });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroBilhete, setErroBilhete] = useState<string | null>(null);
  const toast = useToast();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const jogosY = useRef(0);
  const irParaJogos = () =>
    scrollRef.current?.scrollTo({ y: jogosY.current, animated: true });
  const irParaTopo = () =>
    scrollRef.current?.scrollTo({ y: 0, animated: true });

  const eu = home?.eu?.entrou ? home.eu : null;
  const noDraft = useMemo(
    () => Object.values(draft).reduce((s, n) => s + n, 0),
    [draft],
  );
  const livres = (eu?.fichas_livres ?? 0) - noDraft;
  const aberta = home?.liga?.status === "aberta";
  const valendo =
    !!home?.liga &&
    (home.liga.status !== "aberta" || home.jogos.some((j) => j.comecou));

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshHome();
    setRefreshing(false);
  };

  const run = async (
    fn: () => Promise<string>,
    setE: (e: string | null) => void = setErro,
  ) => {
    setBusy(true);
    setE(null);
    try {
      toast.show(await fn());
    } catch (e) {
      setE(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const entrar = () =>
    run(async () => {
      irParaJogos();
      await entrarNaLiga();
      setTimeout(irParaJogos, 50);
      return `Você entrou na múltipla! ${home?.regras.fichas_por_entrada} FICHAS pra distribuir.`;
    });

  const confirmar = () =>
    run(async () => {
      const n = await apostar(
        Object.fromEntries(Object.entries(draft).filter(([, f]) => f > 0)),
      );
      setDraft({});
      irParaTopo();
      return `Palpite confirmado: ${n} fichas distribuídas.`;
    }, setErroBilhete);

  if (!home) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader />
        <View className="p-4">
          {homeErro ? (
            <>
              <EmptyState icon="cloud-offline-outline" title={homeErro} />
              <Button
                title="Tentar de novo"
                onPress={onRefresh}
                className="mt-3"
              />
            </>
          ) : null}
        </View>
      </View>
    );
  }

  const itensBilhete: ItemBilhete[] = home.jogos.flatMap((j) =>
    j.mercados
      .filter((m) => m.id in draft)
      .map((m) => ({
        id: m.id,
        jogo: `${j.time_casa} x ${j.time_fora}`,
        grupo: m.grupo,
        descricao: m.descricao,
        multiplicador: m.multiplicador,
        fichas: draft[m.id] ?? 0,
      })),
  );
  const destaque = home.jogos.find((j) => j.destaque);
  const outros = home.jogos.filter((j) => j !== destaque);

  const renderJogo = (j: Jogo) => {
    const podeApostar = !!eu && aberta && !j.comecou;
    return (
      <Card
        key={j.id}
        className={`mb-3 ${j.destaque ? "border-2 border-primary" : ""}`}
      >
        {j.destaque ? (
          <View className="mb-2 flex-row items-center self-start rounded-full bg-primary px-2.5 py-1">
            <Ionicons name="star" size={12} color={C.onPrimary} />
            <T className="ml-1 font-mont-xb text-[10px] tracking-widest text-onPrimary">
              JOGO DO DIA
            </T>
          </View>
        ) : null}
        <T className="text-[11px] uppercase tracking-widest text-muted">
          {j.campeonato} • {fmtData(j.horario)}
          {j.comecou ? " • EM JOGO" : ""}
        </T>
        <T
          className={`mt-1 font-mont-xb ${j.destaque ? "text-xl" : "text-base"}`}
        >
          {j.time_casa} x {j.time_fora}
        </T>
        <View className="mt-3">
          {agruparMercados(j.mercados).map((g) => {
            const confirmadas = g.opcoes.filter(
              (m) => (m.minhas_fichas ?? 0) > 0,
            );
            return (
              <View key={g.grupo} className="mb-3">
                {g.grupo ? (
                  <T className="mb-1.5 font-mont-xb text-xs uppercase tracking-widest text-muted">
                    {g.grupo}
                  </T>
                ) : null}
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {g.opcoes.map((m) => {
                    const minhas = m.minhas_fichas ?? 0;
                    const noBilhete = m.id in draft;
                    const resultado =
                      home.liga?.status === "finalizada"
                        ? m.resultado_final
                          ? "green"
                          : minhas > 0
                            ? "red"
                            : null
                        : null;
                    return (
                      <View
                        key={m.id}
                        style={{ flexGrow: 1, flexBasis: "30%" }}
                      >
                        <BetButton
                          compact
                          descricao={m.descricao}
                          multiplicador={m.multiplicador}
                          selected={noBilhete}
                          resultado={resultado}
                          disabled={!podeApostar}
                          onPress={() =>
                            setDraft((d) => {
                              if (!(m.id in d)) return { ...d, [m.id]: 0 };
                              const { [m.id]: _, ...rest } = d;
                              return rest;
                            })
                          }
                        />
                      </View>
                    );
                  })}
                </View>
                {confirmadas.length > 0 ? (
                  <T className="mt-1 px-1 text-xs text-muted">
                    {confirmadas
                      .map((m) => `${m.minhas_fichas} fichas em ${m.descricao}`)
                      .join(" • ")}{" "}
                    (confirmadas)
                  </T>
                ) : null}
              </View>
            );
          })}
          {j.mercados.length === 0 ? (
            <T className="text-sm text-muted">Mercados em breve.</T>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <View className="flex-1 bg-bg">
      <AppHeader />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Object.keys(draft).length > 0 ? 440 : 120,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {!home.liga ? (
          <EmptyState
            icon="calendar-outline"
            title="Nenhuma múltipla aberta agora"
            subtitle="Volte mais tarde: os jogos do dia estão sendo escolhidos."
          />
        ) : (
          <>
            <View className="mb-3 flex-row items-center justify-between">
              <T className="font-mont-xb text-xl">
                {home.liga.data === home.data
                  ? "Múltipla do dia"
                  : `Múltipla de ${home.liga.data.slice(8, 10)}/${home.liga.data.slice(5, 7)}`}
              </T>
              <StatusBadge status={home.liga.status} />
            </View>
            <PremioBar
              premio={home.premio}
              finalizada={home.liga.status === "finalizada"}
              descricao={home.liga.premio_desc}
            />

            <Card className="mt-3">
              {!user ? (
                <>
                  <T className="font-mont-b text-sm">
                    Entre com {home.regras.custo_entrada_pontos} PONTOS e receba{" "}
                    {home.regras.fichas_por_entrada} FICHAS pra distribuir.
                  </T>
                  <Button
                    title="Palpitar"
                    icon="football"
                    onPress={() => router.push("/entrar")}
                    className="mt-3"
                  />
                </>
              ) : !eu ? (
                <>
                  <T className="font-mont-b text-sm">
                    Entrada: {home.regras.custo_entrada_pontos} PONTOS →{" "}
                    {home.regras.fichas_por_entrada} FICHAS
                  </T>
                  <T className="text-xs text-muted">
                    Seu saldo: {fmtPts(user.saldo_pontos)} PONTOS
                  </T>
                  <Button
                    title="Palpitar"
                    icon="football"
                    onPress={entrar}
                    loading={busy}
                    disabled={!aberta}
                    className="mt-3"
                  />
                </>
              ) : valendo ? (
                <View className="flex-row justify-around">
                  <Stat label="Pontuação" value={fmtPts(eu.pontuacao)} />
                  <Stat
                    label="Posição"
                    value={eu.posicao ? `${eu.posicao}º` : "—"}
                  />
                </View>
              ) : (
                <SituacaoFichas
                  livres={livres}
                  noBilhete={noDraft}
                  confirmadas={eu.fichas_usadas}
                />
              )}
              <ErrorBox erro={erro} />
            </Card>
            <Button
              title={
                valendo
                  ? "Ver quem entrou e os palpites"
                  : `Quem entrou e os palpites (${home.premio.palpiteiros})`
              }
              icon="people-outline"
              variant="ghost"
              onPress={() => router.push("/palpiteiros")}
              className="mt-2"
            />

            <View onLayout={(e) => (jogosY.current = e.nativeEvent.layout.y)}>
              <SectionTitle>Jogos</SectionTitle>
            </View>
            {destaque ? renderJogo(destaque) : null}
            {outros.map(renderJogo)}
          </>
        )}
      </ScrollView>
      {itensBilhete.length > 0 ? (
        <Bilhete
          itens={itensBilhete}
          livres={livres}
          busy={busy}
          erro={erroBilhete}
          onChange={(id, v) => setDraft((d) => ({ ...d, [id]: v }))}
          onRemove={(id) =>
            setDraft((d) => {
              const { [id]: _, ...rest } = d;
              return rest;
            })
          }
          onConfirmar={confirmar}
        />
      ) : null}
      {toast.node}
    </View>
  );
}

function Stat({
  label,
  value,
  ficha,
}: {
  label: string;
  value: string;
  ficha?: boolean;
}) {
  return (
    <View className="items-center">
      <View className="flex-row items-center">
        <T className="font-odds text-2xl text-primary">{value}</T>
        {ficha ? (
          <View className="ml-1.5">
            <Ficha size={22} />
          </View>
        ) : null}
      </View>
      <T className="text-[10px] uppercase tracking-widest text-muted">
        {label}
      </T>
    </View>
  );
}

function SituacaoFichas({
  livres,
  noBilhete,
  confirmadas,
}: {
  livres: number;
  noBilhete: number;
  confirmadas: number;
}) {
  const { palette: C } = useTheme();
  if (livres > 0) {
    return (
      <View className="flex-row items-center">
        <Ficha size={32} />
        <View className="ml-3 flex-1">
          <T className="font-mont-xb text-base">
            {fmtPts(livres)} fichas pra distribuir
          </T>
          <T className="text-xs text-muted">
            {noBilhete > 0
              ? `${fmtPts(noBilhete)} no bilhete. Confirme lá embaixo.`
              : "Toque nas opções dos jogos pra montar seu bilhete."}
          </T>
        </View>
      </View>
    );
  }
  return (
    <View className="flex-row items-center">
      <Ionicons
        name={noBilhete > 0 ? "receipt-outline" : "checkmark-circle"}
        size={32}
        color={C.primary}
      />
      <View className="ml-3 flex-1">
        <T className="font-mont-xb text-base">
          {noBilhete > 0 ? "Todas as fichas no bilhete" : "Palpite completo!"}
        </T>
        <T className="text-xs text-muted">
          {noBilhete > 0
            ? "Confirme o bilhete lá embaixo pra valer."
            : `${fmtPts(confirmadas)} fichas distribuídas. A pontuação aparece quando os jogos começarem.`}
        </T>
      </View>
    </View>
  );
}
