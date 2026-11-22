import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Linking from "expo-linking";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
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
import { track } from "../../lib/analytics";
import {
  alternarOdd,
  corMultipla,
  type Draft,
  DRAFT_VAZIO,
  fichasNoDraft,
} from "../../lib/bilhete";
import { copiar, compartilhar, linkIndicacao, mensagemConvite } from "../../lib/convite";
import { useDesktop } from "../../lib/desktop";
import { fmtData, fmtOdd, fmtPts, rotuloPalpite } from "../../lib/format";
import { errorMessage, useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import { agruparMercados } from "../../types";
import { GrupoTitulo } from "../../components/GrupoTitulo";
import {
  familiaGrupo,
  linhaGrupo,
  ORDEM_PRINCIPAL,
  rankSecao,
  secaoDo,
} from "../../lib/secoes";
import type { Jogo, MinhaSituacao, MultiplaView } from "../../types";

const MERCADOS_VISIVEIS = 2;

/** Dentro do PRINCIPAL, a ordem dos grupos segue ORDEM_PRINCIPAL; fora dele não reordena. */
const rankPrincipal = (g: { grupo: string; opcoes: { secao?: string | null }[] }) =>
  (g.opcoes[0]?.secao ?? secaoDo(g.grupo)) === "PRINCIPAL"
    ? ORDEM_PRINCIPAL.indexOf(g.grupo) + 1 || ORDEM_PRINCIPAL.length + 1
    : 0;

export default function HomeMultipla() {
  const { palette: C, scheme } = useTheme();
  const { home, homeErro, refreshHome, user, entrarNaLiga, apostar } = useApp();
  const desktop = useDesktop();
  // Modal da sequência: deriva do bonus_login. `bonusVisto` guarda a chave do bônus
  // já exibido/dispensado para não reabrir a cada refetch; `streakManual` cobre o
  // clique no indicador do header.
  const bonus = home?.bonus_login ?? null;
  const bonusKey = bonus
    ? `${bonus.dia}:${bonus.pontos}:${bonus.quebrou}`
    : null;
  const [streakManual, setStreakManual] = useState<{
    dia: number;
    pontos: number;
    quebrou: boolean;
  } | null>(null);
  const [bonusVisto, setBonusVisto] = useState<string | null>(null);
  const streak =
    streakManual ?? (bonus && bonusKey !== bonusVisto ? bonus : null);
  const fecharStreak = () => {
    setStreakManual(null);
    setBonusVisto(bonusKey);
  };
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
  const [verBilhete, setVerBilhete] = useState(false);
  const [conviteModal, setConviteModal] = useState(false);
  const [abertos, setAbertos] = useState<string[]>([]);
  // Seções recolhidas por jogo: chave "<jogoId>|<SEÇÃO>".
  const [secoesOcultas, setSecoesOcultas] = useState<Record<string, boolean>>({});
  const [gruposOcultos, setGruposOcultos] = useState<Record<string, boolean>>({});
  const [jogExpandidos, setJogExpandidos] = useState<Record<string, boolean>>({});
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
    const t = setTimeout(
      () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
      150,
    );
    return () => clearTimeout(t);
  }, [palpitou]);
  const [editandoKey, setEditandoKey] = useState<string | null>(null);
  const editando = editandoKey === draftKey;

  // Palpites confirmados que ainda dá pra mexer: jogos que não começaram.
  const editaveis = useMemo(() => {
    const simples: Record<string, number> = {};
    for (const j of home?.jogos ?? []) {
      if (j.comecou) continue;
      for (const m of j.mercados)
        if ((m.minhas_fichas ?? 0) > 0) simples[m.id] = m.minhas_fichas!;
    }
    const multiplas = (eu?.multiplas ?? []).filter((m) =>
      m.pernas.every((p) => !p.comecou),
    );
    const fichas =
      Object.values(simples).reduce((s, f) => s + f, 0) +
      multiplas.reduce((s, m) => s + m.fichas, 0);
    return { simples, multiplas, fichas };
  }, [home?.jogos, eu?.multiplas]);

  // Bilhete confirmado (visão "SEU BILHETE"): todos os palpites com fichas,
  // inclusive de jogos já começados.
  const meuBilhete = useMemo(() => {
    const simples = (home?.jogos ?? []).flatMap((j) =>
      j.mercados
        .filter((m) => (m.minhas_fichas ?? 0) > 0)
        .map((m) => ({
          jogo: `${j.time_casa} x ${j.time_fora}`,
          descricao: m.descricao,
          grupo: m.grupo,
          fichas: m.minhas_fichas!,
          odd: m.multiplicador,
          // Mercado só mostra resultado quando foi apurado (decidido) ou a rodada fechou
          // (aí o pendente conta como perdido). Jogo acabado sem apuração fica pendente.
          decidido: !!m.decidido || home?.liga?.status === "finalizada",
          certo: m.resultado_final,
        })),
    );
    const multiplas = eu?.multiplas ?? [];
    const nPalpites = simples.length + multiplas.length;
    // Enquanto nenhum mercado decidido, o ranking mostra o potencial;
    // depois, a pontuação ao vivo (fichas ganhas − reapostadas).
    const temDecidido =
      simples.some((s) => s.decidido) ||
      multiplas.some((mu) => mu.pernas.some((p) => p.finalizado));
    const potencial =
      simples.reduce((s, p) => s + p.fichas * p.odd, 0) +
      multiplas.reduce((s, m) => s + m.fichas * m.odd, 0);
    return { simples, multiplas, nPalpites, temDecidido, potencial };
  }, [home?.jogos, home?.liga?.status, eu?.multiplas]);

  const editarBilhete = () => {
    const ms = editaveis.multiplas.map((m) => ({
      mercados: m.pernas.map((p) => p.mercado_id),
      fichas: m.fichas,
    }));
    const itens = [
      ...new Set([
        ...Object.keys(editaveis.simples),
        ...ms.flatMap((m) => m.mercados),
      ]),
    ];
    setDraft({ itens, simples: { ...editaveis.simples }, multiplas: ms });
    setEditandoKey(draftKey);
    track("Abriu edição do bilhete", { origem: "liga" });
  };
  const cancelarEdicao = () => {
    setDraft(DRAFT_VAZIO);
    setEditandoKey(null);
    track("Cancelou edição do bilhete", { origem: "liga" });
  };

  const fichasLivresBase =
    (eu?.fichas_livres ?? 0) + (editando ? editaveis.fichas : 0);
  const noDraft = useMemo(() => fichasNoDraft(draft), [draft]);
  const livres = fichasLivresBase - noDraft;
  const aberta = home?.liga?.status === "aberta";
  const valendo =
    !!home?.liga &&
    (home.liga.status !== "aberta" || home.jogos.some((j) => j.comecou));
  // Só sugere distribuir fichas enquanto existe jogo aberto pra apostar.
  const temJogoAberto = !!home?.liga && aberta && home.jogos.some((j) => !j.comecou);
  // Rodada decidida: liga finalizada ou todos os jogos já apurados.
  const rodadaDecidida =
    !!home?.liga &&
    (home.liga.status === "finalizada" ||
      (home.jogos.length > 0 && home.jogos.every((j) => j.finalizado)));
  const campeao = palpitou && rodadaDecidida && (eu?.posicao ?? 0) === 1;

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
      const n = await apostar(
        {
          simples: Object.fromEntries(
            draft.itens
              .filter((id) => (draft.simples[id] ?? 0) > 0)
              .map((id) => [id, draft.simples[id]]),
          ),
          multiplas: draft.multiplas.filter((m) => m.mercados.length > 0),
        },
        editando,
      );
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
            <T
              className="flex-shrink text-[11px] uppercase tracking-widest text-muted"
              numberOfLines={1}
            >
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
            <T
              className={`mx-1.5 font-mont-xb ${j.destaque ? "text-xl" : "text-base"}`}
              numberOfLines={1}
              style={{ flexShrink: 0 }}
            >
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
        {!j.finalizado || j.mercados.some((m) => (m.minhas_fichas ?? 0) > 0) ? (
          <View className="mt-3">
            {(() => {
              const gruposVis = agruparMercados(
                j.finalizado
                  ? j.mercados.filter((m) => (m.minhas_fichas ?? 0) > 0)
                  : j.mercados,
              )
                .filter(
                  (_, gi) => gi < MERCADOS_VISIVEIS || abertos.includes(j.id),
                )
                .sort(
                  (a, b) =>
                    rankSecao(a.opcoes[0]?.secao ?? secaoDo(a.grupo)) -
                      rankSecao(b.opcoes[0]?.secao ?? secaoDo(b.grupo)) ||
                    rankPrincipal(a) - rankPrincipal(b) ||
                    familiaGrupo(a.grupo).localeCompare(familiaGrupo(b.grupo)) ||
                    linhaGrupo(a.grupo) - linhaGrupo(b.grupo),
                );
              const secoesJogo: { nome: string; grupos: typeof gruposVis }[] = [];
              for (const g of gruposVis) {
                const sec = g.opcoes[0]?.secao ?? secaoDo(g.grupo);
                // Seção por família: "ESCANTEIOS 8.5" e "ESCANTEIOS 9.5" entram
                // juntos em "ESCANTEIOS", linhas crescentes dentro.
                const nome = sec === "PRINCIPAL" ? "PRINCIPAL" : familiaGrupo(g.grupo);
                const s = secoesJogo.find((x) => x.nome === nome);
                if (s) s.grupos.push(g);
                else secoesJogo.push({ nome, grupos: [g] });
              }
              const expandido = abertos.includes(j.id);
              return secoesJogo.map((s) => {
                const chave = `${j.id}|${s.nome}`;
                // Sem expandir, mostra os grupos soltos; ao expandir, só o PRINCIPAL abre de cara.
                const oculta = expandido
                  ? (secoesOcultas[chave] ?? s.nome !== "PRINCIPAL")
                  : false;
                return (
                  <View key={s.nome}>
                    {expandido ? (
                    <Pressable
                      onPress={() =>
                        setSecoesOcultas((o) => ({ ...o, [chave]: !oculta }))
                      }
                      className="mb-1 mt-1 flex-row items-center active:opacity-70"
                      accessibilityLabel={`${oculta ? "Expandir" : "Recolher"} seção ${s.nome}`}
                    >
                      <Ionicons
                        name={oculta ? "chevron-forward" : "chevron-down"}
                        size={14}
                        color={C.primary}
                      />
                      <T className="ml-1 font-mont-xb text-sm text-primary">
                        {s.nome}
                      </T>
                    </Pressable>
                    ) : null}
                    {oculta
                      ? null
                      : s.grupos.map((g) => {
                          const gchave = `${j.id}|${g.grupo}`;
                          const goculto = !!gruposOcultos[gchave];
                          const ehJogador =
                            (g.opcoes[0]?.secao ?? secaoDo(g.grupo)) === "JOGADOR";
                          const opcoesVis =
                            ehJogador && !jogExpandidos[gchave]
                              ? g.opcoes.slice(0, 9)
                              : g.opcoes;
                          return (
                          <View key={g.grupo} className="mb-3">
                            {g.grupo && g.grupo !== s.nome ? (
                              <View className="flex-row items-center">
                                <Pressable
                                  onPress={() =>
                                    setGruposOcultos((o) => ({
                                      ...o,
                                      [gchave]: !goculto,
                                    }))
                                  }
                                  hitSlop={8}
                                  accessibilityLabel={`${goculto ? "Expandir" : "Recolher"} mercado ${g.grupo}`}
                                >
                                  <Ionicons
                                    name={goculto ? "chevron-forward" : "chevron-down"}
                                    size={12}
                                    color={C.muted}
                                  />
                                </Pressable>
                                <View className="ml-0.5 flex-1">
                                  <GrupoTitulo grupo={g.grupo} />
                                </View>
                              </View>
                            ) : null}
                            {goculto ? null : (
                            <View
                              className="flex-row flex-wrap"
                              style={{ gap: 6 }}
                            >
                              {opcoesVis.map((m) => {
                        const minhas =
                          editando && !j.comecou ? 0 : (m.minhas_fichas ?? 0);
                        const noBilhete = draft.itens.includes(m.id);
                        const resultado =
                          home.liga?.status === "finalizada" || m.decidido
                            ? m.resultado_final
                              ? "green"
                              : minhas > 0
                                ? "red"
                                : null
                            : null;
                        return (
                          <View
                            key={m.id}
                            style={{
                              flexGrow: 1,
                              flexBasis: "30%",
                              minWidth: 0,
                            }}
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
                            )}
                            {!goculto && ehJogador && g.opcoes.length > 9 ? (
                              <Pressable
                                onPress={() =>
                                  setJogExpandidos((o) => ({
                                    ...o,
                                    [gchave]: !o[gchave],
                                  }))
                                }
                                className="mt-0.5 flex-row items-center active:opacity-70"
                              >
                                <Ionicons
                                  name={
                                    jogExpandidos[gchave]
                                      ? "chevron-up"
                                      : "chevron-down"
                                  }
                                  size={12}
                                  color={C.muted}
                                />
                                <T className="ml-1 font-mont-b text-[11px] text-muted">
                                  {jogExpandidos[gchave]
                                    ? "Ver menos"
                                    : `Ver + ${g.opcoes.length - 9}`}
                                </T>
                              </Pressable>
                            ) : null}
                          </View>
                          );
                        })}
                  </View>
                );
              });
            })()}
            {agruparMercados(j.mercados).length > MERCADOS_VISIVEIS ? (
              <Pressable
                onPress={() =>
                  setAbertos((a) =>
                    a.includes(j.id)
                      ? a.filter((x) => x !== j.id)
                      : [...a, j.id],
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
        onStreak={() =>
          setStreakManual({
            dia: home.usuario?.login_streak ?? 1,
            pontos: 0,
            quebrou: false,
          })
        }
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: draft.itens.length > 0 && !desktop ? 480 : 120,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View
          style={
            desktop
              ? {
                  maxWidth: 1180,
                  width: "100%",
                  alignSelf: "center",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 20,
                }
              : undefined
          }
        >
          <View style={desktop ? { flex: 1, minWidth: 0 } : undefined}>
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
                  {palpitou && home.liga.status !== "finalizada" ? (
                    <View className="flex-row items-center rounded-full bg-primary/15 px-2.5 py-1">
                      <Ionicons
                        name="checkmark-circle"
                        size={12}
                        color={C.primary}
                      />
                      <T className="ml-1 font-mont-b text-[10px] tracking-widest text-primary">
                        PALPITE FEITO
                      </T>
                    </View>
                  ) : (
                    <StatusBadge status={home.liga.status} />
                  )}
                </View>
                {/* Prêmio só aqui em cima: troféu + descrição + barra de
                    progresso (palpitou). Nada duplicado abaixo dos especiais. */}
                <PremioBar
                  premio={home.premio}
                  finalizada={home.liga.status === "finalizada"}
                  encerrada={!temJogoAberto}
                  descricao={home.liga.premio_desc}
                  onPalpiteiros={
                    eu ? undefined : () => router.push("/palpiteiros")
                  }
                  semContagem={!!eu}
                  onConvidar={() => convidar(home.liga?.premio_desc, user?.username)}
                  completo={palpitou}
                />

                {user && !eu ? (
                  <EntradaModal
                    visible={explicando}
                    custo={home.regras.custo_entrada_pontos}
                    fichas={home.regras.fichas_por_entrada}
                    saldo={user.saldo_pontos}
                    streak={home.usuario?.login_streak ?? 0}
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
                  {!eu ||
                  campeao ||
                  (palpitou &&
                    !temJogoAberto &&
                    home.liga.status !== "finalizada") ||
                  (temJogoAberto && (eu.fichas_ganhas ?? 0) > 0) ||
                  (aberta && editando) ||
                  (temJogoAberto &&
                    (!valendo || editaveis.fichas > 0 || livres > 0) &&
                    livres + noDraft > 0) ||
                  erro ? (
                    <Card className="mt-3">
                      {!user ? (
                        <>
                          <CarrosselJogos
                            jogos={
                              destaque ? [destaque, ...outros] : home.jogos
                            }
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
                            jogos={
                              destaque ? [destaque, ...outros] : home.jogos
                            }
                            onOdd={chamarPalpitar}
                          />
                          <PulsoBrilho sinal={sinal}>
                            <Button
                              title="Palpitar"
                              icon="football"
                              onPress={() => setExplicando(true)}
                              disabled={!aberta || busy}
                              className="mt-3"
                            />
                          </PulsoBrilho>
                        </>
                      ) : (
                        <>
                          {temJogoAberto &&
                          (!valendo || editaveis.fichas > 0 || livres > 0) &&
                          livres + noDraft > 0 ? (
                            <SituacaoFichas
                              livres={livres}
                              noBilhete={noDraft}
                            />
                          ) : null}
                          {temJogoAberto &&
                          (eu.fichas_ganhas ?? 0) > 0 ? (
                            <T className="mb-2 text-center text-xs text-muted">
                              Você já recuperou {fmtPts(eu.fichas_ganhas!)}{" "}
                              fichas. Dá pra distribuir de novo nos jogos que
                              não começaram e seguir subindo no ranking.
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
                          ) : null}
                          {campeao ? (
                            <View className="items-center py-1">
                              <Text style={{ fontSize: 30 }}>🏆</Text>
                              <T className="mt-1.5 font-mont-b text-sm">
                                Campeão da rodada!
                              </T>
                              <T className="mt-0.5 text-center text-xs text-muted">
                                Seu bilhete rendeu {fmtPts(eu?.pontuacao ?? 0)}{" "}
                                pts. O voucher do prêmio cai no seu perfil pra
                                resgatar.
                              </T>
                            </View>
                          ) : palpitou &&
                            !temJogoAberto &&
                            home.liga.status !== "finalizada" ? (
                            <View className="items-center py-1">
                              <Ionicons
                                name="trophy-outline"
                                size={22}
                                color={C.primary}
                              />
                              <T className="mt-1.5 font-mont-b text-sm">
                                Rodada fechada! Agora é torcer.
                              </T>
                              <T className="mt-0.5 text-center text-xs text-muted">
                                Seu bilhete tá valendo. Acompanhe sua posição
                                no ranking de hoje.
                              </T>
                            </View>
                          ) : null}
                        </>
                      )}
                      <ErrorBox erro={erro} />
                    </Card>
                  ) : null}
                </View>

                {/* Especiais do dia: até 10 mercados que o admin destaca —
                    só pra quem ainda não palpitou (empurra pro 1º palpite). */}
                {!palpitou && (home.especiais?.length ?? 0) > 0 ? (
                  <View className="mt-3">
                    <View className="mb-2 flex-row items-center">
                      <View className="mr-2 h-4 w-1 rounded-full bg-primary" />
                      <T className="font-mont-xb text-sm uppercase tracking-wide">
                        Especiais em destaque
                      </T>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {home.especiais!.map((e) => {
                        const selecionado = draft.itens.includes(e.id);
                        const pode = !!eu && aberta && !e.comecou;
                        return (
                          <Pressable
                            key={e.id}
                            onPress={() =>
                              pode
                                ? setDraft((d) => alternarOdd(d, e.id))
                                : chamarPalpitar()
                            }
                            className={`w-36 flex-row self-stretch overflow-hidden rounded-xl border ${
                              selecionado
                                ? "border-primary bg-cardAlt"
                                : "border-line bg-card"
                            }`}
                          >
                            <View className="w-1 bg-primary" />
                            <View className="flex-1 justify-between p-3">
                              <View>
                                <T
                                  className="font-mont-b text-[9px] uppercase tracking-widest text-muted"
                                  numberOfLines={1}
                                >
                                  {siglaTime(e.time_casa)} X{" "}
                                  {siglaTime(e.time_fora)}
                                </T>
                                <T
                                  className="font-mont-xb text-[10px] uppercase tracking-widest"
                                  numberOfLines={2}
                                >
                                  {e.grupo}
                                </T>
                                <T
                                  className="mt-1 font-mont text-xs text-muted"
                                  numberOfLines={2}
                                >
                                  {e.descricao}
                                </T>
                              </View>
                              <View
                                className={`mt-2 rounded-lg border px-2 py-1.5 ${
                                  selecionado
                                    ? "border-primary bg-primary"
                                    : "border-line bg-cardAlt"
                                }`}
                              >
                                <T
                                  className={`text-center font-odds text-sm ${
                                    selecionado
                                      ? "text-onPrimary"
                                      : "text-primary"
                                  }`}
                                >
                                  {fmtOdd(e.multiplicador)}
                                </T>
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {palpitou && eu ? (
                  <>
                    <Pressable onPress={() => setVerBilhete(true)}>
                      <Card className="mt-3">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1">
                            <T className="font-mont-b text-[10px] tracking-widest text-muted">
                              SEU BILHETE
                            </T>
                            <View className="mt-0.5 flex-row items-center">
                              <T className="font-mont-xb text-sm">
                                {meuBilhete.nPalpites}{" "}
                                {meuBilhete.nPalpites === 1
                                  ? "palpite"
                                  : "palpites"}
                                {" · "}
                                {fmtPts(eu.fichas_usadas)}{" "}
                              </T>
                              <Ficha size={13} />
                              <T className="font-mont-xb text-sm">
                                {" distribuídas"}
                              </T>
                            </View>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={C.muted}
                          />
                        </View>
                      </Card>
                    </Pressable>
                    <Pressable onPress={() => router.push("/palpiteiros")}>
                      <Card className="mt-3">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1">
                            <T className="font-mont-b text-[10px] tracking-widest text-muted">
                              RANKING DE HOJE
                            </T>
                            <T className="mt-0.5 font-mont-xb text-sm">
                              Você está em {eu.posicao ? `${eu.posicao}º` : "—"}{" "}
                              ·{" "}
                              {meuBilhete.temDecidido ? (
                                `${fmtPts(eu.pontuacao)} pts`
                              ) : (
                                <T className="font-mont-xb text-sm text-primary">
                                  {fmtPts(Math.round(meuBilhete.potencial))} pts
                                  potencial
                                </T>
                              )}
                            </T>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={C.muted}
                          />
                        </View>
                      </Card>
                    </Pressable>
                    <SectionTitle>Chame a galera</SectionTitle>
                    <View className="flex-row" style={{ gap: 10 }}>
                      <Pressable
                        onPress={() => router.push("/desafio")}
                        className="flex-1"
                      >
                        <Card>
                          <Ionicons
                            name="medal-outline"
                            size={22}
                            color={C.primary}
                          />
                          <T className="mt-1.5 font-mont-b text-sm">
                            Desafie amigos
                          </T>
                          <T className="mt-0.5 text-xs text-muted">
                            Duelo ou grupo: quem acerta mais leva
                          </T>
                        </Card>
                      </Pressable>
                      {user?.username ? (
                        <Pressable
                          onPress={() => setConviteModal(true)}
                          className="flex-1"
                        >
                          <Card>
                            <Ionicons
                              name="people-outline"
                              size={22}
                              color={C.primary}
                            />
                            <T className="mt-1.5 font-mont-b text-sm">
                              Convide & ganhe
                            </T>
                            <T className="mt-0.5 text-xs text-muted">
                              {`Ganhe até ${home.regras.pontos_indicacao_max ?? 500} pts por amigo`}
                            </T>
                          </Card>
                        </Pressable>
                      ) : null}
                    </View>
                  </>
                ) : null}

                <View
                  onLayout={(e) => (jogosY.current = e.nativeEvent.layout.y)}
                >
                  <SectionTitle>Jogos</SectionTitle>
                </View>
                {destaque ? renderJogo(destaque) : null}
                {desktop ? (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      marginHorizontal: -6,
                    }}
                  >
                    {outros.map((j) => (
                      <View
                        key={j.id}
                        style={{ width: "50%", paddingHorizontal: 6 }}
                      >
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
          {desktop && eu && home.liga ? (
            <View
              style={[
                { width: 340 },
                { position: "sticky", top: 16 } as object,
              ]}
            >
              {aberta || draft.itens.length > 0 ? (
                <Bilhete
                  draft={draft}
                  opcoes={opcoes}
                  fichasLivres={fichasLivresBase}
                  fichasGanhas={eu?.fichas_ganhas ?? 0}
                  offsetMultiplas={offsetMultiplas}
                  onChange={setDraft}
                  rail
                  onResumo={() => {
                    track("Abriu resumo do bilhete", { origem: "liga" });
                    setErroBilhete(null);
                    setResumo(true);
                  }}
                />
              ) : (
                <Card>
                  <T className="font-mont-xb text-sm">Meu bilhete</T>
                  <T className="mt-1 text-xs leading-4 text-muted">
                    A rodada não aceita mais palpites. Acompanhe seus acertos
                    nos jogos ao lado.
                  </T>
                </Card>
              )}
              {editando && draft.itens.length === 0 ? (
                <Card className="mt-3">
                  <T className="mb-2 text-center text-xs text-muted">
                    Você tirou todos os palpites dos jogos que não começaram.
                  </T>
                  <Button
                    title="Salvar alterações"
                    disabled={busy}
                    onPress={confirmar}
                  />
                  <ErrorBox erro={erroBilhete} />
                </Card>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
      {streak ? (
        <StreakModal
          dia={streak.dia}
          pontos={streak.pontos}
          quebrou={streak.quebrou}
          onFechar={fecharStreak}
        />
      ) : null}
      {eu ? (
        <ResumoBilhete
          visible={resumo}
          draft={draft}
          opcoes={opcoes}
          fichasLivres={fichasLivresBase}
          fichasGanhas={eu?.fichas_ganhas ?? 0}
          offsetMultiplas={offsetMultiplas}
          busy={busy}
          erro={erroBilhete}
          onChange={setDraft}
          onFechar={() => setResumo(false)}
          onConfirmar={confirmar}
        />
      ) : null}
      {desktop ? null : eu && draft.itens.length > 0 ? (
        <Bilhete
          draft={draft}
          opcoes={opcoes}
          fichasLivres={fichasLivresBase}
          fichasGanhas={eu?.fichas_ganhas ?? 0}
          offsetMultiplas={offsetMultiplas}
          onChange={setDraft}
          onResumo={() => {
            track("Abriu resumo do bilhete", { origem: "liga" });
            setErroBilhete(null);
            setResumo(true);
          }}
        />
      ) : editando && eu ? (
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t-2 border-primary bg-card p-4">
          <T className="mb-2 text-center text-sm text-muted">
            Você tirou todos os palpites dos jogos que não começaram.
          </T>
          <Button
            title="Salvar alterações"
            disabled={busy}
            onPress={confirmar}
          />
          <ErrorBox erro={erroBilhete} />
        </View>
      ) : null}
      {/* SEU BILHETE › : distribuição das fichas confirmadas + editar.
          Editar entra no mesmo rascunho do botão "Editar bilhete" do hero. */}
      <Modal
        visible={verBilhete}
        transparent
        animationType="slide"
        onRequestClose={() => setVerBilhete(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setVerBilhete(false)}
        >
          <Pressable
            className="max-h-[80%] rounded-t-3xl bg-card p-4"
            onPress={(e) => e.stopPropagation()}
          >
            <T className="mb-3 font-mont-xb text-base">Meu bilhete</T>
            <ScrollView>
              {eu ? <DistribuicaoBilhete eu={eu} bilhete={meuBilhete} /> : null}
            </ScrollView>
            {aberta ? (
              <Button
                title="Editar bilhete"
                icon="create-outline"
                className="mt-3"
                onPress={() => {
                  setVerBilhete(false);
                  editarBilhete();
                }}
              />
            ) : null}
            <Button
              title="Fechar"
              variant="ghost"
              className="mt-2"
              onPress={() => setVerBilhete(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
      {/* CONVIDE & GANHE › regras do programa + copiar mensagem / mandar no WhatsApp. */}
      <Modal
        visible={conviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConviteModal(false)}
      >
        <Pressable
          className="flex-1 justify-center bg-black/50 p-5"
          onPress={() => setConviteModal(false)}
        >
          <Pressable
            className="rounded-3xl bg-card p-5"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Ionicons name="people" size={22} color={C.primary} />
              <T className="font-mont-xb text-base">Convide & ganhe</T>
            </View>
            <T className="mt-3 text-sm text-muted">
              {`Ganhe pontos para cada amigo que entrar pelo seu link:\n\n+ ${home.regras.pontos_indicacao ?? 50} pts quando ele se cadastrar\n+ ${home.regras.indicacao_palpite ?? 50} pts se ele palpitar no mesmo dia\n+ ${home.regras.indicacao_login ?? 100} pts a cada dia que ele voltar (3 dias)\n+ ${home.regras.indicacao_bonus ?? 100} pts de bônus se completar os 3 logins\n\nTotal: até ${home.regras.pontos_indicacao_max ?? 500} pts por amigo!`}
            </T>
            <Button
              title="Mandar no WhatsApp"
              icon="logo-whatsapp"
              className="mt-4"
              onPress={() => {
                setConviteModal(false);
                if (user?.username) convidarIndicacao(user.username, home.liga?.premio_desc);
              }}
            />
            <Button
              title="Copiar mensagem"
              variant="outline"
              icon="copy-outline"
              className="mt-2"
              onPress={async () => {
                if (!user?.username) return;
                const ok = await copiar(mensagemConvite(linkIndicacao(user.username), home.liga?.premio_desc));
                if (!ok) await compartilhar(mensagemConvite(linkIndicacao(user.username), home.liga?.premio_desc));
                setConviteModal(false);
                toast.show("Mensagem copiada!");
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
      {toast.node}
    </View>
  );
}

/** "Meu bilhete" do modal: mesma dinâmica do ResumoBilhete — barrinha de
    distribuição das fichas + bloco SIMPLES + um bloco por MÚLTIPLA — só leitura. */
function DistribuicaoBilhete({
  eu,
  bilhete,
}: {
  eu: Extract<MinhaSituacao, { entrou: true }>;
  bilhete: {
    simples: {
      jogo: string;
      descricao: string;
      grupo: string;
      fichas: number;
      odd: number;
      decidido: boolean;
      certo: boolean;
    }[];
    multiplas: MultiplaView[];
  };
}) {
  const { palette: C, scheme } = useTheme();
  const totalSimples = bilhete.simples.reduce((s, p) => s + p.fichas, 0);
  const usadas =
    totalSimples + bilhete.multiplas.reduce((s, m) => s + m.fichas, 0);
  const livres = Math.max(0, eu.fichas_total - usadas);
  const segmentos = [
    { cor: C.primary, n: totalSimples, label: "Simples" },
    ...bilhete.multiplas.map((m, i) => ({
      cor: corMultipla(i, scheme),
      n: m.fichas,
      label: `Múltipla ${i + 1}`,
    })),
  ];

  const icone = (decidido: boolean, certo: boolean) =>
    !decidido ? null : certo ? (
      <Ionicons name="checkmark-circle" size={15} color={C.primary} />
    ) : (
      <Ionicons name="close-circle" size={15} color={C.danger} />
    );

  return (
    <View>
      <View className="mb-3 rounded-2xl border border-line bg-cardAlt p-3">
        <View className="flex-row items-center justify-between">
          <T className="font-mont-b text-sm">Onde estão suas fichas</T>
          <T className="font-odds text-sm">
            {fmtPts(usadas)} / {fmtPts(eu.fichas_total)}
          </T>
        </View>
        <View
          className="my-2 h-2 flex-row overflow-hidden rounded-full bg-card"
          style={{ gap: 2 }}
        >
          {segmentos
            .filter((s) => s.n > 0)
            .map((s) => (
              <View
                key={s.label}
                style={{ flex: s.n, backgroundColor: s.cor }}
              />
            ))}
          {livres > 0 ? <View style={{ flex: livres }} /> : null}
        </View>
        <View
          className="flex-row flex-wrap"
          style={{ columnGap: 10, rowGap: 2 }}
        >
          {segmentos.map((s) => (
            <T
              key={s.label}
              className="font-mont-b text-[11px]"
              style={{ color: s.cor }}
            >
              ■ {s.label}{" "}
              <T className="font-mont-xb text-[11px]">{fmtPts(s.n)}</T>
            </T>
          ))}
          {livres > 0 ? (
            <T className="font-mont-b text-[11px] text-muted">
              ■ Livres{" "}
              <T className="font-mont-xb text-[11px]">{fmtPts(livres)}</T>
            </T>
          ) : null}
        </View>
      </View>

      {bilhete.simples.length > 0 ? (
        <BlocoBilhete titulo="SIMPLES" cor={C.primary}>
          {bilhete.simples.map((p, i) => (
            <View
              key={i}
              className={`flex-row items-center px-3 py-2 ${i ? "border-t border-line" : ""}`}
            >
              <View className="flex-1 pr-2">
                <T className="text-[10px] text-muted">{p.jogo}</T>
                <T className="font-mont-b text-[13px]">
                  {rotuloPalpite(p.grupo, p.descricao)}
                </T>
              </View>
              <View className="mr-2 flex-row items-center">
                <Ficha size={13} />
                <T className="ml-1 text-xs">{p.fichas}</T>
              </View>
              <T className="mr-2 font-odds text-base text-primary">
                {fmtOdd(p.odd)}
              </T>
              <T className="mr-2 text-[11px] text-muted">
                →{" "}
                <T className="font-mont-xb text-xs text-primary">
                  {fmtPts(Math.round(p.fichas * p.odd * 100) / 100)}
                </T>
              </T>
              {icone(p.decidido, p.certo)}
            </View>
          ))}
        </BlocoBilhete>
      ) : null}

      {bilhete.multiplas.map((m, i) => {
        const cor = corMultipla(i, scheme);
        return (
          <BlocoBilhete key={m.id} titulo={`MÚLTIPLA ${i + 1}`} cor={cor}>
            {m.pernas.map((p, k) => (
              <View
                key={p.mercado_id}
                className={`flex-row items-center px-3 py-2 ${k ? "border-t border-line" : ""}`}
              >
                <View className="flex-1 pr-2">
                  <T className="text-[10px] text-muted">{p.jogo}</T>
                  <T className="font-mont-b text-[13px]">
                    {rotuloPalpite(p.grupo, p.descricao)}
                  </T>
                </View>
                <T className="mr-2 font-odds text-base" style={{ color: cor }}>
                  <T className="text-xs text-muted">{k ? "× " : ""}</T>
                  {p.odd.toFixed(2)}
                </T>
                {icone(p.finalizado, p.resultado_final)}
              </View>
            ))}
            <View
              className="flex-row items-center border-t border-line px-3 py-2"
              style={{ backgroundColor: cor + "18" }}
            >
              <T className="flex-1 font-mont-xb text-[10px] tracking-widest text-muted">
                {fmtPts(m.fichas)} FICHAS · MULTIPLICADOR TOTAL
              </T>
              <T className="font-odds text-lg" style={{ color: cor }}>
                {fmtOdd(m.odd).slice(0, -1)}
              </T>
              <T className="ml-1 text-[11px] text-muted">
                →{" "}
                <T className="font-mont-xb text-sm" style={{ color: cor }}>
                  {fmtPts(Math.round(m.fichas * m.odd * 100) / 100)}
                </T>
              </T>
            </View>
          </BlocoBilhete>
        );
      })}
    </View>
  );
}

function BlocoBilhete({
  titulo,
  cor,
  children,
}: {
  titulo: string;
  cor: string;
  children: React.ReactNode;
}) {
  return (
    <View
      className="mb-3 rounded-2xl p-2.5"
      style={{
        borderWidth: 1.5,
        borderColor: cor,
        backgroundColor: cor + "0F",
      }}
    >
      <View
        className="mb-2 self-start rounded-md px-2 py-0.5"
        style={{ backgroundColor: cor }}
      >
        <T className="font-mont-xb text-[11px] tracking-widest text-white">
          {titulo}
        </T>
      </View>
      <View className="overflow-hidden rounded-xl border border-line bg-card">
        {children}
      </View>
    </View>
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
            ? "Revise e confirme o bilhete pra valer."
            : "Toque nas opções dos jogos pra montar seu bilhete."}
        </T>
      </View>
    </View>
  );
}

function convidar(premio?: string | null, username?: string) {
  // O convite carrega o ref do usuário: quem se cadastra por ele conta como indicação.
  const url = username
    ? linkIndicacao(username)
    : (process.env.EXPO_PUBLIC_APP_URL ?? "https://vhendrica.github.io/palpitei/app/");
  const msg = mensagemConvite(url, premio);
  if (Platform.OS === "web") {
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  } else {
    Share.share({ message: msg });
  }
}

/** Indicação: mesmo texto do convite, mas o link marca quem convidou (ref=username). */
function convidarIndicacao(username: string, premio?: string | null) {
  const msg = mensagemConvite(linkIndicacao(username), premio);
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
              <T
                className="text-[9px] font-mont-b uppercase"
                numberOfLines={1}
                style={{ maxWidth: "100%" }}
              >
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
        <T className="font-mont-xb text-[9px] tracking-widest text-muted">
          FINALIZADO
        </T>
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
        Animated.timing(a, {
          toValue: 0.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(a, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <View className="ml-2 flex-row items-center rounded-full bg-primary/15 px-2 py-0.5">
      <Animated.View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: C.primary,
          opacity: a,
        }}
      />
      <T className="ml-1 font-mont-xb text-[9px] tracking-widest text-primary">
        AO VIVO
      </T>
    </View>
  );
}

function siglaTime(nome: string) {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "");
  return limpo.slice(0, 3).toUpperCase() || nome.slice(0, 3).toUpperCase();
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
