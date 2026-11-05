import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, ScrollView, Share, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { Ficha } from "../../components/Ficha";
import { GrupoTitulo } from "../../components/GrupoTitulo";
import { ErrorBox, Stepper } from "../../components/Form";
import { Button, Card, StatusBadge, T } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtData, fmtOdd, fmtPontos, rotuloPalpite } from "../../lib/format";
import { errorMessage, useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import { agruparMercados, type DesafioDetalhe } from "../../types";

const horaFmt = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Tela do desafio: jogos+mercados, distribuição de fichas (Simples), ranking, compartilhar. */
export default function Detalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette: C } = useTheme();
  const { user } = useApp();
  const [d, setD] = useState<DesafioDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.desafios.detalhe(String(id));
      setD(r);
      // Draft inicial = fichas já confirmadas em mercados de jogos que não começaram.
      const ini: Record<string, number> = {};
      for (const j of r.jogos) {
        if (j.comecou) continue;
        for (const m of j.mercados) {
          if (m.minhas_fichas && m.minhas_fichas > 0) ini[m.id] = m.minhas_fichas;
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
  const totalDraft = Object.values(draft).reduce((s, v) => s + v, 0);
  const livres = Math.max(0, base - totalDraft);

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

  const confirmar = useCallback(async () => {
    setSalvando(true);
    try {
      await api.desafios.apostar(String(id), { simples: draft, multiplas: [] });
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
            <View className="mt-2">
              {agruparMercados(j.mercados).map((g) => (
                <View key={g.grupo || "_"} className="mt-2">
                  {g.grupo ? <GrupoTitulo grupo={g.grupo} /> : null}
                  {g.opcoes.map((m) => {
                    const val = draft[m.id] ?? 0;
                    const pode = !!(aberta && !j.comecou && eu);
                    const travado = m.decidido || m.resultado_final;
                    return (
                      <View key={m.id} className="flex-row items-center py-1.5">
                        <View className="flex-1 pr-2">
                          <T className="text-sm">
                            {rotuloPalpite(m.grupo, m.descricao)}
                            {(m.minhas_fichas ?? 0) > 0 && !pode ? ` · ${m.minhas_fichas} fichas` : ""}
                          </T>
                        </View>
                        <T className="mr-2 font-odds text-sm text-primary">{fmtOdd(m.multiplicador)}</T>
                        {pode ? (
                          <Stepper
                            value={val}
                            onChange={(v) => setDraft((s) => ({ ...s, [m.id]: v }))}
                            step={10}
                            max={livres}
                            ficha
                            editavel
                          />
                        ) : travado ? (
                          <Ionicons
                            name={m.resultado_final ? "checkmark-circle" : "close-circle"}
                            size={18}
                            color={m.resultado_final ? C.primary : C.danger}
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </Card>
        ))}

        {eu && aberta ? (
          <Card className="mt-2 flex-row items-center">
            <View className="flex-row items-center">
              <Ficha size={18} />
              <T className="ml-1 font-mont-b text-sm">{livres} livres</T>
            </View>
            <View className="flex-1" />
            <Button
              title="Confirmar palpites"
              compact
              onPress={confirmar}
              disabled={totalDraft === 0 || salvando}
              loading={salvando}
            />
          </Card>
        ) : null}

        {d && d.ranking.length > 0 ? (
          <>
            <T className="mb-2 mt-4 font-mont-xb text-xs uppercase text-muted">Ranking</T>
            {d.ranking.map((r) => (
              <Card key={r.posicao} className="mb-2 flex-row items-center py-2">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-cardAlt">
                  <T className="font-mont-xb text-xs">{r.posicao}º</T>
                </View>
                <T className="ml-3 flex-1 font-mont-b text-sm">{r.nome}</T>
                <T className="font-odds text-sm text-primary">{fmtPontos(r.pontuacao)} pts</T>
              </Card>
            ))}
          </>
        ) : null}

        {liga?.e_dono && liga.status !== "finalizada" ? (
          <Button title="Finalizar desafio" variant="danger" className="mt-4" onPress={finalizar} />
        ) : null}
      </ScrollView>
    </View>
  );
}