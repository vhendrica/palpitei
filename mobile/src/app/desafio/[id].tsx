import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, ScrollView, Share, TextInput, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { BetButton } from "../../components/BetButton";
import { Bilhete, type OpcaoBilhete } from "../../components/Bilhete";
import { GrupoTitulo } from "../../components/GrupoTitulo";
import { PalpiteiroBilhete } from "../../components/PalpiteiroBilhete";
import { ErrorBox } from "../../components/Form";
import { Button, Card, StatusBadge, T } from "../../components/ui";
import { api } from "../../lib/api";
import {
  alternarOdd,
  corMultipla,
  DRAFT_VAZIO,
  fichasNoDraft,
  type Draft,
} from "../../lib/bilhete";
import { fmtData, fmtPontos } from "../../lib/format";
import { errorMessage, useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import { agruparMercados, type DesafioDetalhe, type PalpiteiroView } from "../../types";

const horaFmt = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Tela do desafio: jogos+mercados, distribuição de fichas (Simples), ranking, compartilhar. */
export default function Detalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette: C, scheme } = useTheme();
  const { user } = useApp();
  const [d, setD] = useState<DesafioDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(DRAFT_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [placarInput, setPlacarInput] = useState<Record<string, { casa: string; fora: string }>>({});
  const [bilhetes, setBilhetes] = useState<PalpiteiroView[] | null>(null);
  const [bilheteAberto, setBilheteAberto] = useState<number | null>(null);

  const toggleBilhete = useCallback(
    async (posicao: number) => {
      if (bilheteAberto === posicao) {
        setBilheteAberto(null);
        return;
      }
      setBilheteAberto(posicao);
      if (!bilhetes) {
        try {
          const r = await api.desafios.palpiteiros(String(id));
          setBilhetes(r.palpiteiros);
        } catch {
          /* toast global já avisa */
        }
      }
    },
    [id, bilheteAberto, bilhetes],
  );

  const load = useCallback(async () => {
    try {
      const r = await api.desafios.detalhe(String(id));
      setD(r);
      // Draft inicial = bilhete confirmado que ainda dá pra editar (jogos não iniciados).
      const ini: Draft = { itens: [], simples: {}, multiplas: [] };
      for (const j of r.jogos) {
        if (j.comecou) continue;
        for (const m of j.mercados) {
          if ((m.minhas_fichas ?? 0) > 0) {
            ini.itens.push(m.id);
            ini.simples[m.id] = m.minhas_fichas!;
          }
        }
      }
      for (const m of r.eu && r.eu.entrou ? r.eu.multiplas ?? [] : []) {
        if (!m.pernas.every((p) => !p.comecou)) continue;
        ini.multiplas.push({
          mercados: m.pernas.map((p) => p.mercado_id),
          fichas: m.fichas,
        });
        for (const p of m.pernas) {
          if (!ini.itens.includes(p.mercado_id)) ini.itens.push(p.mercado_id);
        }
      }
      setDraft(ini);
      setErro(null);
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const liga = d?.liga;
  const eu = d?.eu && d.eu.entrou ? d.eu : null;
  const aberta = liga?.status === "aberta";

  // Fichas que posso distribuir: as livres + as já postas em jogos não iniciados (edição libera).
  const base = useMemo(() => {
    if (!d || !eu) return 0;
    let b = eu.fichas_livres;
    for (const j of d.jogos) {
      if (j.comecou) continue;
      for (const m of j.mercados) b += m.minhas_fichas ?? 0;
    }
    return b;
  }, [d, eu]);
  const noDraft = fichasNoDraft(draft);
  const livres = Math.max(0, base - noDraft);

  // Múltiplas confirmadas com perna já iniciada: ficam travadas (offset dos selos).
  const travadas = (eu?.multiplas ?? []).filter(
    (m) => !m.pernas.every((p) => !p.comecou),
  );
  const opcoes: Record<string, OpcaoBilhete> = d
    ? Object.fromEntries(
        d.jogos.flatMap((j) =>
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
      )
    : {};
  const selosDe = (id: string) => [
    ...(id in draft.simples ? [{ label: "S", cor: C.primary }] : []),
    ...travadas.flatMap((m, i) =>
      m.pernas.some((p) => p.mercado_id === id)
        ? [{ label: `M${i + 1}`, cor: corMultipla(i, scheme) }]
        : [],
    ),
    ...draft.multiplas.flatMap((m, i) =>
      m.mercados.includes(id)
        ? [
            {
              label: `M${i + 1 + travadas.length}`,
              cor: corMultipla(i + travadas.length, scheme),
            },
          ]
        : [],
    ),
  ];

  const compartilhar = useCallback(() => {
    if (!liga) return;
    const nome = liga.titulo ?? `Desafio de ${liga.dono}`;
    // Web: o app roda em <domínio>/app/... — o link precisa do prefixo. Nativo: scheme palpitei://.
    const url =
      Platform.OS === "web" && typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname.split("/desafio")[0]}/desafio/convite?token=${liga.convite}`
        : `palpitei://desafio/convite?token=${liga.convite}`;
    Share.share({
      message: `Entra no "${nome}" no PALPIT! ${liga.fichas_por_entrada} fichas grátis pra palpitar: ${url}`,
    }).catch(() => {});
  }, [liga]);

  const entrar = useCallback(async () => {
    setEntrando(true);
    try {
      await api.desafios.entrar(String(id));
      await load();
    } catch (e) {
      setErro(errorMessage(e));
    }
    setEntrando(false);
  }, [id, load]);

  const lancarPlacar = useCallback(async (jogoId: string) => {
    const p = placarInput[jogoId];
    if (!p?.casa || !p?.fora) return;
    try {
      await api.desafios.placar(String(id), jogoId, Number(p.casa), Number(p.fora));
      setPlacarInput((s) => ({ ...s, [jogoId]: { casa: "", fora: "" } }));
      await load();
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, [id, placarInput, load]);

  const confirmar = useCallback(async () => {
    setSalvando(true);
    try {
      await api.desafios.apostar(String(id), {
        simples: Object.fromEntries(
          draft.itens
            .filter((mid) => (draft.simples[mid] ?? 0) > 0)
            .map((mid) => [mid, draft.simples[mid]]),
        ),
        multiplas: draft.multiplas.filter((m) => m.mercados.length > 0),
      });
      await load();
      Alert.alert("Feito!", "Palpites confirmados.");
    } catch (e) {
      setErro(errorMessage(e));
    }
    setSalvando(false);
  }, [id, draft, load]);

  const finalizar = useCallback(() => {
    Alert.alert("Finalizar desafio", "Mercados não apurados contam como perdidos. Confirmar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Finalizar",
        style: "destructive",
        onPress: async () => {
          try {
            await api.desafios.finalizar(String(id));
            await load();
          } catch (e) {
            setErro(errorMessage(e));
          }
        },
      },
    ]);
  }, [id, load]);

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title={liga?.titulo ?? "Desafio"} back />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
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
        {liga ? (
          <>
            <View className="mb-3 flex-row items-center">
              <View className="flex-1">
                <T className="text-sm text-muted">
                  de {liga.dono} · {fmtData(liga.data)} · {d!.palpiteiros}{" "}
                  {d!.palpiteiros === 1 ? "palpiteiro" : "palpiteiros"}
                </T>
                <View className="mt-1 flex-row items-center">
                  <StatusBadge status={liga.status} />
                  {eu ? (
                    <T className="ml-2 text-xs text-muted">
                      {fmtPontos(eu.pontuacao)} pts{eu.posicao ? ` · ${eu.posicao}º` : ""}
                    </T>
                  ) : null}
                </View>
              </View>
              <Pressable
                onPress={compartilhar}
                className="h-10 w-10 items-center justify-center rounded-full bg-cardAlt"
                accessibilityLabel="Compartilhar convite"
              >
                <Ionicons name="share-social-outline" size={20} color={C.primary} />
              </Pressable>
            </View>

            {!user ? (
              <Button
                title="Entre na sua conta pra participar"
                variant="outline"
                className="mb-3"
                onPress={() => router.push("/entrar")}
              />
            ) : d!.eu && !d!.eu.entrou && aberta ? (
              <Button
                title={`Entrar no desafio (ganha ${liga.fichas_por_entrada} fichas)`}
                className="mb-3"
                onPress={entrar}
                loading={entrando}
              />
            ) : null}
          </>
        ) : null}

        {d?.jogos.map((j) => (
          <Card key={j.id} className="mb-2">
            <View className="flex-row items-center">
              <View className="flex-1">
                <T className="font-mont-b text-sm">
                  {j.time_casa} x {j.time_fora}
                </T>
                <T className="text-xs text-muted">
                  {j.campeonato} · {horaFmt(j.horario)}
                  {j.comecou && !j.finalizado ? " · AO VIVO" : ""}
                  {j.finalizado ? " · FINALIZADO" : ""}
                </T>
              </View>
              {j.placar ? (
                <T className="font-mont-xb text-base">
                  {j.placar.casa} - {j.placar.fora}
                </T>
              ) : null}
            </View>
            {liga?.e_dono && !j.finalizado ? (
              <View className="mt-2 flex-row items-center">
                <T className="mr-2 text-xs text-muted">Placar final:</T>
                <TextInput
                  className="w-11 rounded border border-line px-1.5 py-1 text-center font-odds text-sm"
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={C.muted}
                  value={placarInput[j.id]?.casa ?? ""}
                  onChangeText={(t) =>
                    setPlacarInput((s) => ({
                      ...s,
                      [j.id]: { ...s[j.id], casa: t, fora: s[j.id]?.fora ?? "" },
                    }))
                  }
                />
                <T className="mx-1 text-muted">x</T>
                <TextInput
                  className="w-11 rounded border border-line px-1.5 py-1 text-center font-odds text-sm"
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={C.muted}
                  value={placarInput[j.id]?.fora ?? ""}
                  onChangeText={(t) =>
                    setPlacarInput((s) => ({
                      ...s,
                      [j.id]: { casa: s[j.id]?.casa ?? "", fora: t },
                    }))
                  }
                />
                <Pressable
                  onPress={() => lancarPlacar(j.id)}
                  className="ml-2 rounded-lg bg-primary px-2.5 py-1"
                >
                  <T className="text-xs text-onPrimary">Lançar</T>
                </Pressable>
              </View>
            ) : null}
            <View className="mt-2">
              {agruparMercados(j.mercados).map((g) => (
                <View key={g.grupo || "_"} className="mt-2">
                  {g.grupo ? <GrupoTitulo grupo={g.grupo} /> : null}
                  <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {g.opcoes.map((m) => {
                    const pode = !!(aberta && !j.comecou && eu);
                    const resultado =
                      j.finalizado || m.decidido
                        ? m.resultado_final
                          ? "green"
                          : (m.minhas_fichas ?? 0) > 0
                            ? "red"
                            : null
                        : null;
                    return (
                      <View key={m.id} style={{ flexGrow: 1, flexBasis: "30%", minWidth: 0 }}>
                        <BetButton
                          compact
                          descricao={m.descricao}
                          multiplicador={m.multiplicador}
                          selected={draft.itens.includes(m.id)}
                          fichas={pode ? 0 : (m.minhas_fichas ?? 0)}
                          selos={selosDe(m.id)}
                          resultado={resultado}
                          disabled={!pode && !m.decidido && !m.resultado_final}
                          onPress={() => (pode ? setDraft((d) => alternarOdd(d, m.id)) : undefined)}
                        />
                      </View>
                    );
                  })}
                </View>
                </View>
              ))}
            </View>
          </Card>
        ))}

        

        {d && d.ranking.length > 0 ? (
          <>
            <T className="mb-2 mt-4 font-mont-xb text-xs uppercase text-muted">Ranking</T>
            {d.ranking.map((r) => {
              const aberto = bilheteAberto === r.posicao;
              const bilhete = aberto ? bilhetes?.find((b) => b.posicao === r.posicao) : null;
              return (
                <Pressable key={r.posicao} onPress={() => toggleBilhete(r.posicao)}>
                  <Card className="mb-2 py-2">
                    <View className="flex-row items-center">
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-cardAlt">
                        <T className="font-mont-xb text-xs">{r.posicao}º</T>
                      </View>
                      <T className="ml-3 flex-1 font-mont-b text-sm">{r.nome}</T>
                      <T className="font-odds text-sm text-primary">{fmtPontos(r.pontuacao)} pts</T>
                      <Ionicons
                        name={aberto ? "chevron-up" : "chevron-down"}
                        size={15}
                        color={C.muted}
                        style={{ marginLeft: 8 }}
                      />
                    </View>
                    {aberto ? (
                      <View className="mt-2 border-t border-line pt-2">
                        {bilhetes == null ? (
                          <T className="text-xs text-muted">Carregando…</T>
                        ) : bilhete && (bilhete.palpites.length > 0 || bilhete.multiplas.length > 0) ? (
                          <PalpiteiroBilhete p={bilhete} />
                        ) : (
                          <T className="text-xs text-muted">Nenhum palpite ainda.</T>
                        )}
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
          </>
        ) : null}

        {liga?.e_dono && liga.status !== "finalizada" ? (
          <Button title="Finalizar desafio" variant="danger" className="mt-4" onPress={finalizar} />
        ) : null}
      </ScrollView>
      {eu && aberta && draft.itens.length > 0 ? (
        <Bilhete
          draft={draft}
          opcoes={opcoes}
          fichasLivres={base}
          offsetMultiplas={travadas.length}
          onChange={setDraft}
          onResumo={confirmar}
        />
      ) : null}
    </View>
  );
}