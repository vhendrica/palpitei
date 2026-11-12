import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Linking from "expo-linking";
import {
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  View,
  type ScrollViewInstance,
} from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { BetButton } from "../../components/BetButton";
import { Bilhete, type OpcaoBilhete } from "../../components/Bilhete";
import { ResumoBilhete } from "../../components/ResumoBilhete";
import { EntradaModal } from "../../components/EntradaModal";
import { StreakModal } from "../../components/StreakModal";
import { ErrorBox } from "../../components/Form";
import { Ficha } from "../../components/Ficha";
import { PremioBar, PremioLinha } from "../../components/PremioBar";
import { useToast } from "../../components/Toast";
import {
  Button,
  Card,
  EmptyState,
  SectionTitle,
  StatusBadge,
  T,
} from "../../components/ui";
import { alternarOdd, corMultipla, type Draft, DRAFT_VAZIO, fichasNoDraft } from "../../lib/bilhete";
import { useDesktop } from "../../lib/desktop";
import { fmtData, fmtPontos, fmtPts } from "../../lib/format";
import { errorMessage, useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import { agruparMercados } from "../../types";
import { GrupoTitulo } from "../../components/GrupoTitulo";
import { secaoDo } from "../../lib/secoes";
import type { Jogo } from "../../types";

const MERCADOS_VISIVEIS = 2;

export default function HomeMultipla() {
  const { palette: C, scheme } = useTheme();
  const { home, homeErro, refreshHome, user, entrarNaLiga, apostar } = useApp();
  const desktop = useDesktop();
  const [streak, setStreak] = useState<{ dia: number; pontos: number; quebrou: boolean } | null>(null);
  useEffect(() => {
    if (home?.bonus_login) setStreak(home.bonus_login);
  }, [home?.bonus_login]);
  const [refreshing, setRefreshing] = useState(false);
  const draftKey = `${home?.liga?.id}:${user?.id}`;
  const [draftState, setDraftState] = useState<{
    key: string;
    v: Draft;
  }>({ key: "", v: DRAFT_VAZIO });
  const draft = useMemo(
    () => (draftState.key === draftKey ? draftState.v : DRAFT_VAZIO),
    [draftState, draftKey],
  );
  const [resumo, setResumo] = useState(false);
  const [abertos, setAbertos] = useState<string[]>([]);
  const setDraft = (fn: Draft | ((d: Draft) => Draft)) =>
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
  const palpitarY = useRef(0);
  const [sinal, setSinal] = useState(0);
  const chamarPalpitar = () => setSinal((n) => n + 1);
  useEffect(() => {
    if (sinal)
      scrollRef.current?.scrollTo({
        y: Math.max(0, palpitarY.current - 12),
        animated: true,
      });
  }, [sinal]);
  const irParaTopo = () =>
    scrollRef.current?.scrollTo({ y: 0, animated: true });

  const eu = home?.eu?.entrou ? home.eu : null;
  const palpitou = !!eu && eu.fichas_usadas > 0;
  // Ao confirmar o 1º palpite, sobe até o prêmio pra ver a barra pulando.
  const palpitouAntes = useRef(palpitou);
  useEffect(() => {
    const antes = palpitouAntes.current;
    palpitouAntes.current = palpitou;
    if (!palpitou || antes) return;
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 150);
    return () => clearTimeout(t);
  }, [palpitou]);
  const [editandoKey, setEditandoKey] = useState<string | null>(null);
  const editando = editandoKey === draftKey;

  // Palpites confirmados que ainda dá pra mexer: jogos que não começaram.
  const editaveis = useMemo(() => {
    const simples: Record<string, number> = {};
    for (const j of home?.jogos ?? []) {
      if (j.comecou) continue;
      for (const m of j.mercados) if ((m.minhas_fichas ?? 0) > 0) simples[m.id] = m.minhas_fichas!;
    }
    const multiplas = (eu?.multiplas ?? []).filter((m) => m.pernas.every((p) => !p.comecou));
    const fichas =
      Object.values(simples).reduce((s, f) => s + f, 0) + multiplas.reduce((s, m) => s + m.fichas, 0);
    return { simples, multiplas, fichas };
  }, [home?.jogos, eu?.multiplas]);

  const editarBilhete = () => {
    const ms = editaveis.multiplas.map((m) => ({
      mercados: m.pernas.map((p) => p.mercado_id),
      fichas: m.fichas,
    }));
    const itens = [...new Set([...Object.keys(editaveis.simples), ...ms.flatMap((m) => m.mercados)])];
    setDraft({ itens, simples: { ...editaveis.simples }, multiplas: ms });
    setEditandoKey(draftKey);
  };
  const cancelarEdicao = () => {
    setDraft(DRAFT_VAZIO);
    setEditandoKey(null);
  };

  const fichasLivresBase = (eu?.fichas_livres ?? 0) + (editando ? editaveis.fichas : 0);
  const noDraft = useMemo(() => fichasNoDraft(draft), [draft]);
  const livres = fichasLivresBase - noDraft;
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

  const [explicando, setExplicando] = useState(false);
  const entrar = () =>
    run(async () => {
      setExplicando(false);
      irParaJogos();
      await entrarNaLiga();
      setTimeout(irParaJogos, 50);
      return `Você entrou na rodada! ${home?.regras.fichas_por_entrada} FICHAS pra distribuir.`;
    });

  const confirmar = () =>
    run(async () => {
      const n = await apostar({
        simples: Object.fromEntries(
          draft.itens
            .filter((id) => (draft.simples[id] ?? 0) > 0)
            .map((id) => [id, draft.simples[id]]),
        ),
        multiplas: draft.multiplas.filter((m) => m.mercados.length > 0),
      }, editando);
      setDraft(DRAFT_VAZIO);
      setEditandoKey(null);
      if (editando) {
        setResumo(false);
        irParaTopo();
        return "Bilhete atualizado.";
      }
      setResumo(false);
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

  const opcoes: Record<string, OpcaoBilhete> = Object.fromEntries(
    home.jogos.flatMap((j) =>
      j.mercados.map((m) => [
        m.id,
        {
          id: m.id,
          jogo_id: j.id,
          time_casa: j.time_casa,
          time_fora: j.time_fora,
          jogo: `${j.time_casa} x ${j.time_fora}`,
          grupo: m.grupo,
          descricao: m.descricao,
          odd: m.multiplicador,
        },
      ]),
    ),
  );
  const confirmadas = (eu?.multiplas ?? []).filter(
    (m) => !editando || !editaveis.multiplas.includes(m),
  );
  const offsetMultiplas = confirmadas.length;
  const selosDe = (id: string) => [
    ...confirmadas.flatMap((m, i) =>
      m.pernas.some((p) => p.mercado_id === id)
        ? [{ label: `M${i + 1}`, cor: corMultipla(i, scheme) }]
        : [],
    ),
    ...(id in draft.simples ? [{ label: "S", cor: C.primary }] : []),
    ...draft.multiplas.flatMap((m, i) =>
      m.mercados.includes(id)
        ? [
            {
              label: `M${i + 1 + offsetMultiplas}`,
              cor: corMultipla(i + offsetMultiplas, scheme),
            },
          ]
        : [],
    ),
  ];
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
        <Pressable
          onPress={() =>
            setAbertos((a) =>
              a.includes(j.id) ? a.filter((x) => x !== j.id) : [...a, j.id],
            )
          }
        >
        <View className="flex-row items-center">
          <T className="flex-shrink text-[11px] uppercase tracking-widest text-muted" numberOfLines={1}>
            {j.campeonato} • {fmtData(j.horario)}
          </T>
          <StatusJogo jogo={j} />
        </View>
        <View className="mt-1 flex-row items-center">
          <T
            className={`font-mont-xb ${j.destaque ? "text-xl" : "text-base"}`}
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {j.time_casa}
          </T>
          <T className={`mx-1.5 font-mont-xb ${j.destaque ? "text-xl" : "text-base"}`}>
            {j.placar ? `${j.placar.casa} x ${j.placar.fora}` : "x"}
          </T>
          <T
            className={`font-mont-xb ${j.destaque ? "text-xl" : "text-base"}`}
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {j.time_fora}
          </T>
        </View>
        </Pressable>
        {!j.finalizado ? (
        <View className="mt-3">
          {agruparMercados(j.mercados)
            .filter((_, gi) => gi < MERCADOS_VISIVEIS || abertos.includes(j.id))
            .map((g, gi, arr) => {
            const sec = g.opcoes[0]?.secao ?? secaoDo(g.grupo);
            const novaSecao =
              gi === 0 ||
              (arr[gi - 1].opcoes[0]?.secao ?? secaoDo(arr[gi - 1].grupo)) !== sec;
            return (
              <View key={g.grupo} className="mb-3">
                {novaSecao && sec !== "PRINCIPAL" ? (
                  <T className="mb-1 mt-1 font-mont-xb text-sm text-primary">{sec}</T>
                ) : null}
                {g.grupo ? <GrupoTitulo grupo={g.grupo} /> : null}
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {g.opcoes.map((m) => {
                    const minhas =
                      editando && !j.comecou ? 0 : (m.minhas_fichas ?? 0);
                    const noBilhete = draft.itens.includes(m.id);
                    const resultado =
                      home.liga?.status === "finalizada" || j.finalizado || m.decidido
                        ? m.resultado_final
                          ? "green"
                          : minhas > 0
                            ? "red"
                            : null
                        : null;
                    return (
                      <View
                        key={m.id}
                        style={{ flexGrow: 1, flexBasis: "30%", minWidth: 0 }}
                      >
                        <BetButton
                          compact
                          descricao={m.descricao}
                          multiplicador={m.multiplicador}
                          selected={noBilhete}
                          fichas={minhas}
                          selos={selosDe(m.id)}
                          resultado={resultado}
                          disabled={
                            !podeApostar && (!!eu || !aberta || j.comecou)
                          }
                          onPress={() =>
                            podeApostar
                              ? setDraft((d) => alternarOdd(d, m.id))
                              : chamarPalpitar()
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
          {agruparMercados(j.mercados).length > MERCADOS_VISIVEIS ? (
            <Pressable
              onPress={() =>
                setAbertos((a) =>
                  a.includes(j.id) ? a.filter((x) => x !== j.id) : [...a, j.id],
                )
              }
              className="flex-row items-center justify-center py-1 active:opacity-70"
            >
              <T className="font-mont-b text-xs text-primary">
                {abertos.includes(j.id)
                  ? "Ver menos mercados"
                  : `Ver mais mercados (${agruparMercados(j.mercados).length - MERCADOS_VISIVEIS})`}
              </T>
              <Ionicons
                name={abertos.includes(j.id) ? "chevron-up" : "chevron-down"}
                size={14}
                color={C.primary}
              />
            </Pressable>
          ) : null}
          {j.mercados.length === 0 ? (
            <T className="text-sm text-muted">Mercados em breve.</T>
          ) : null}
        </View>
        ) : null}
      </Card>
    );
  };

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        streak={home.usuario?.login_streak ?? undefined}
        onStreak={() => setStreak({ dia: home.usuario?.login_streak ?? 1, pontos: 0, quebrou: false })}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: draft.itens.length > 0 && !desktop ? 480 : 120,
          paddingRight: desktop && eu ? 360 : 16,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={desktop ? { maxWidth: 980, width: "100%", alignSelf: "center" } : undefined}>
        {!home.liga ? (
          <EmptyState
            icon="calendar-outline"
            title="Nenhuma rodada aberta agora"
            subtitle="Volte mais tarde: os jogos do dia estão sendo escolhidos."
          />
        ) : (
          <>
            <View className="mb-3 flex-row items-center justify-between">
              <T className="font-mont-xb text-xl">
                {home.liga.data === home.data
                  ? "Rodada do dia"
                  : `Rodada de ${home.liga.data.slice(8, 10)}/${home.liga.data.slice(5, 7)}`}
              </T>
              <StatusBadge status={home.liga.status} />
            </View>
            <PremioLinha
              premio={home.premio}
              descricao={home.liga.premio_desc}
              finalizada={home.liga.status === "finalizada"}
            />

            {user && !eu ? (
              <EntradaModal
                visible={explicando}
                custo={home.regras.custo_entrada_pontos}
                fichas={home.regras.fichas_por_entrada}
                saldo={user.saldo_pontos}
                busy={busy}
                onConfirmar={entrar}
                onFechar={() => setExplicando(false)}
              />
            ) : null}
            <View
              onLayout={(e) => {
                palpitarY.current = e.nativeEvent.layout.y;
              }}
            >
              <Card className="mt-3">
                {!user ? (
                  <>
                    <CarrosselJogos
                      jogos={destaque ? [destaque, ...outros] : home.jogos}
                      onOdd={chamarPalpitar}
                    />
                    <PulsoBrilho sinal={sinal}>
                      <Button
                        title="Palpitar"
                        icon="football"
                        onPress={() => router.push("/entrar")}
                        className="mt-3"
                      />
                    </PulsoBrilho>
                  </>
                ) : !eu ? (
                  <>
                    <CarrosselJogos
                      jogos={destaque ? [destaque, ...outros] : home.jogos}
                      onOdd={chamarPalpitar}
                    />
                    <PulsoBrilho sinal={sinal}>
                      <Button
                        title="Palpitar"
                        icon="football"
                        onPress={() => setExplicando(true)}
                        loading={busy}
                        disabled={!aberta}
                        className="mt-3"
                      />
                    </PulsoBrilho>
                  </>
                ) : (
                  <>
                    {(!valendo || editaveis.fichas > 0 || livres > 0) && livres + noDraft > 0 ? (
                      <SituacaoFichas livres={livres} noBilhete={noDraft} />
                    ) : null}
                    {(eu.fichas_ganhas ?? 0) > 0 ? (
                      <T className="mb-2 text-center text-xs text-muted">
                        Seus acertos já devolveram {fmtPts(eu.fichas_ganhas!)} fichas. Dá pra reapostar nos jogos que não começaram.
                      </T>
                    ) : null}
                    {aberta && editando ? (
                      <Button
                        title="Cancelar edição"
                        variant="ghost"
                        icon="close"
                        onPress={cancelarEdicao}
                        className="mb-3"
                      />
                    ) : aberta && editaveis.fichas > 0 && draft.itens.length === 0 ? (
                      <Button
                        title="Editar bilhete"
                        variant="ghost"
                        icon="create-outline"
                        onPress={editarBilhete}
                        className="mb-3"
                      />
                    ) : null}
                    <View className="flex-row justify-around">
                      <Stat label="Pontuação" value={fmtPontos(eu.pontuacao)} />
                      <Stat
                        label="Posição"
                        value={eu.posicao ? `${eu.posicao}º` : "—"}
                      />
                      <Stat
                        label="Palpiteiros ›"
                        value={fmtPts(home.premio.palpiteiros)}
                        onPress={() => router.push("/palpiteiros")}
                      />
                    </View>
                  </>
                )}
                <ErrorBox erro={erro} />
              </Card>
            </View>

            <View className="mt-3">
              <PremioBar
                premio={home.premio}
                finalizada={home.liga.status === "finalizada"}
                descricao={home.liga.premio_desc}
                onPalpiteiros={
                  eu ? undefined : () => router.push("/palpiteiros")
                }
                semContagem={!!eu}
                onConvidar={() => convidar(home.liga?.premio_desc)}
                completo={palpitou}
              />
            </View>

            <View onLayout={(e) => (jogosY.current = e.nativeEvent.layout.y)}>
              <SectionTitle>Jogos</SectionTitle>
            </View>
            {destaque ? renderJogo(destaque) : null}
            {desktop ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}>
                {outros.map((j) => (
                  <View key={j.id} style={{ width: "50%", paddingHorizontal: 6 }}>
                    {renderJogo(j)}
                  </View>
                ))}
              </View>
            ) : (
              outros.map(renderJogo)
            )}
          </>
        )}
        </View>
      </ScrollView>
      {streak ? (
        <StreakModal dia={streak.dia} pontos={streak.pontos} quebrou={streak.quebrou} onFechar={() => setStreak(null)} />
      ) : null}
      {eu && (desktop || draft.itens.length > 0) ? (
        <>
          <Bilhete
            draft={draft}
            opcoes={opcoes}
            fichasLivres={fichasLivresBase}
            offsetMultiplas={offsetMultiplas}
            onChange={setDraft}
            rail={desktop}
            onResumo={() => {
              setErroBilhete(null);
              setResumo(true);
            }}
          />
          <ResumoBilhete
            visible={resumo}
            draft={draft}
            opcoes={opcoes}
            fichasLivres={fichasLivresBase}
            offsetMultiplas={offsetMultiplas}
            busy={busy}
            erro={erroBilhete}
            onChange={setDraft}
            onFechar={() => setResumo(false)}
            onConfirmar={confirmar}
          />
        </>
      ) : editando && eu ? (
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t-2 border-primary bg-card p-4">
          <T className="mb-2 text-center text-sm text-muted">
            Você tirou todos os palpites dos jogos que não começaram.
          </T>
          <Button title="Salvar alterações" loading={busy} onPress={confirmar} />
          <ErrorBox erro={erroBilhete} />
        </View>
      ) : null}
      {toast.node}
    </View>
  );
}

function Stat({
  label,
  value,
  ficha,
  onPress,
}: {
  label: string;
  value: string;
  ficha?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      className="items-center active:opacity-70"
      onPress={onPress}
      disabled={!onPress}
    >
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
    </Pressable>
  );
}

function SituacaoFichas({
  livres,
  noBilhete,
}: {
  livres: number;
  noBilhete: number;
}) {
  return (
    <View className="mb-3 flex-row items-center border-b border-line pb-3">
      <Ficha size={28} />
      <View className="ml-3 flex-1">
        <T className="font-mont-xb text-base">
          {livres > 0
            ? `${fmtPts(livres)} fichas pra distribuir`
            : "Todas as fichas no bilhete"}
        </T>
        <T className="text-xs text-muted">
          {noBilhete > 0
            ? "Confirme o bilhete lá embaixo pra valer."
            : "Toque nas opções dos jogos pra montar seu bilhete."}
        </T>
      </View>
    </View>
  );
}

function convidar(premio?: string | null) {
  const url = process.env.EXPO_PUBLIC_APP_URL ?? "https://vhendrica.github.io/palpitei/app/";
  const msg = `Bora palpitar comigo no PALPIT? É de graça${premio ? ` e o campeão leva ${premio}` : ""}! ${url}`;
  if (Platform.OS === "web") {
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  } else {
    Share.share({ message: msg });
  }
}

function CarrosselJogos({
  jogos,
  onOdd,
}: {
  jogos: Jogo[];
  onOdd: () => void;
}) {
  const [largura, setLargura] = useState(0);
  const [atual, setAtual] = useState(0);
  const carrossel = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    if (jogos.length < 2 || !largura) return;
    const t = setTimeout(() => {
      carrossel.current?.scrollTo({
        x: ((atual + 1) % jogos.length) * largura,
        animated: true,
      });
    }, 5000);
    return () => clearTimeout(t);
  }, [atual, largura, jogos.length]);
  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={carrossel}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) =>
          largura &&
          setAtual(Math.round(e.nativeEvent.contentOffset.x / largura))
        }
        scrollEventThrottle={32}
      >
        {jogos.map((j) => (
          <View key={j.id} style={{ width: largura || undefined }}>
            <SlideJogo jogo={j} onOdd={onOdd} />
          </View>
        ))}
      </ScrollView>
      {jogos.length > 1 ? (
        <View className="mt-2 flex-row justify-center">
          {jogos.map((j, i) => (
            <View
              key={j.id}
              className={`mx-0.5 h-1.5 rounded-full ${i === atual ? "w-4 bg-primary" : "w-1.5 bg-line"}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SlideJogo({ jogo, onOdd }: { jogo: Jogo; onOdd: () => void }) {
  const { palette: C } = useTheme();
  const resultado =
    agruparMercados(jogo.mercados).find((g) => /RESULTADO/i.test(g.grupo)) ??
    agruparMercados(jogo.mercados)[0];
  return (
    <View>
      <View className="flex-row items-center">
        <Ionicons name="football" size={12} color={C.primary} />
        <T className="ml-1 flex-1 font-mont-b text-[10px] uppercase tracking-widest text-primary">
          Rodada do dia • {fmtData(jogo.horario)}
        </T>
        <StatusJogo jogo={jogo} />
        {jogo.destaque ? (
          <Ionicons name="star" size={16} color={C.primary} />
        ) : null}
      </View>
      <View className="my-3 flex-row items-center justify-between">
        <Time nome={jogo.time_casa} />
        <T className="font-mont-xb text-base text-muted">X</T>
        <Time nome={jogo.time_fora} />
      </View>
      {resultado ? (
        <View className="flex-row gap-1.5">
          {resultado.opcoes.map((m) => (
            <Pressable
              key={m.id}
              onPress={onOdd}
              className="flex-1 items-center rounded-lg border border-line bg-cardAlt px-1 py-1.5 active:opacity-70"
              style={{ minWidth: 0 }}
            >
              <T className="text-[9px] font-mont-b uppercase" numberOfLines={1} style={{ maxWidth: "100%" }}>
                {m.descricao}
              </T>
              <T className="font-odds text-sm text-primary">
                {m.multiplicador.toFixed(2)}x
              </T>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StatusJogo({ jogo }: { jogo: Jogo }) {
  if (jogo.finalizado) {
    return (
      <View className="ml-2 rounded-full bg-cardAlt px-2 py-0.5">
        <T className="font-mont-xb text-[9px] tracking-widest text-muted">FINALIZADO</T>
      </View>
    );
  }
  return jogo.comecou ? <AoVivo /> : null;
}

function AoVivo() {
  const { palette: C } = useTheme();
  const [a] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 0.25, duration: 600, useNativeDriver: true }),
        Animated.timing(a, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <View className="ml-2 flex-row items-center rounded-full bg-primary/15 px-2 py-0.5">
      <Animated.View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary, opacity: a }}
      />
      <T className="ml-1 font-mont-xb text-[9px] tracking-widest text-primary">AO VIVO</T>
    </View>
  );
}

function Time({ nome }: { nome: string }) {
  return (
    <View className="w-[42%] items-center">
      <T
        className={`text-center font-mont-xb ${nome.length > 14 ? "text-sm" : "text-base"}`}
        numberOfLines={2}
        style={{ maxWidth: "100%" }}
      >
        {nome}
      </T>
    </View>
  );
}

function PulsoBrilho({
  sinal,
  children,
}: {
  sinal: number;
  children: React.ReactNode;
}) {
  const [escala] = useState(() => new Animated.Value(1));
  const [anel] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!sinal) return;
    escala.setValue(1);
    anel.setValue(0);
    const t = (v: Animated.Value, to: number, d: number) =>
      Animated.timing(v, { toValue: to, duration: d, useNativeDriver: true });
    Animated.parallel([
      Animated.sequence([
        t(escala, 1.07, 160),
        t(escala, 1, 160),
        t(escala, 1.07, 160),
        t(escala, 1, 160),
      ]),
      Animated.sequence([
        t(anel, 1, 450),
        t(anel, 0, 0),
        t(anel, 1, 450),
        t(anel, 0, 0),
      ]),
    ]).start();
  }, [sinal, escala, anel]);
  return (
    <View>
      <Animated.View
        pointerEvents="none"
        className="rounded-xl border-2 border-primary"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 12,
          bottom: 0,
          opacity: anel.interpolate({
            inputRange: [0, 1],
            outputRange: [0.8, 0],
          }),
          transform: [
            {
              scaleX: anel.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.08],
              }),
            },
            {
              scaleY: anel.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.5],
              }),
            },
          ],
        }}
      />
      <Animated.View style={{ transform: [{ scale: escala }] }}>
        {children}
      </Animated.View>
    </View>
  );
}
