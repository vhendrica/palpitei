import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, TextInput, useWindowDimensions, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { BetButton } from "../../components/BetButton";
import { Bilhete, type OpcaoBilhete } from "../../components/Bilhete";
import { Confirmar } from "../../components/Confirmar";
import { GrupoTitulo } from "../../components/GrupoTitulo";
import { PalpiteiroBilhete } from "../../components/PalpiteiroBilhete";
import { ErrorBox } from "../../components/Form";
import { ResumoBilhete } from "../../components/ResumoBilhete";
import { Button, Card, Esqueleto, StatusBadge, T } from "../../components/ui";
import { api } from "../../lib/api";
import {
  alternarOdd,
  corMultipla,
  DRAFT_VAZIO,
  fichasNoDraft,
  type Draft,
} from "../../lib/bilhete";
import { compartilhar, copiar, enviarWhatsApp, linkConvite, podeCopiar } from "../../lib/convite";
import { useDesktop } from "../../lib/desktop";
import { fmtData, fmtPontos, fmtPts } from "../../lib/format";
import { guardarRetorno } from "../../lib/retorno";
import { errorMessage, useApp } from "../../store/AppStore";
import { ThemeVars, useTheme } from "../../store/Theme";
import { agruparMercados, type DesafioDetalhe, type Jogo, type PalpiteiroView, type RankingRow } from "../../types";

const horaFmt = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const MERCADOS_VISIVEIS = 2;
const COR_POS: Record<number, string> = { 1: "#F2B01E", 2: "#C0C8D4", 3: "#D08A4E" };

/** Tela do desafio: jogos+mercados, distribuição de fichas (Simples), ranking, compartilhar. */
export default function Detalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette: C, scheme } = useTheme();
  const { user, mostrarToast } = useApp();
  const desktop = useDesktop();
  const { height } = useWindowDimensions();
  const [d, setD] = useState<DesafioDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(DRAFT_VAZIO);
  // Edições não confirmadas: o load não pode recriar o draft por cima delas.
  const dirty = useRef(false);
  const marcaDraft: typeof setDraft = useCallback((v) => {
    dirty.current = true;
    setDraft(v);
  }, []);
  const [salvando, setSalvando] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [placarInput, setPlacarInput] = useState<Record<string, { casa: string; fora: string }>>({});
  const [bilhetes, setBilhetes] = useState<PalpiteiroView[] | null>(null);
  const [bilheteAberto, setBilheteAberto] = useState<number | null>(null);
  const [maisJogos, setMaisJogos] = useState(false);
  const [aba, setAba] = useState<"jogos" | "ranking">("jogos");
  const [abertos, setAbertos] = useState<string[]>([]);
  const [resumo, setResumo] = useState(false);
  const [erroBilhete, setErroBilhete] = useState<string | null>(null);
  const [confirmaFim, setConfirmaFim] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [rankingCompleto, setRankingCompleto] = useState(false);

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
      // Bilhetes abertos no ranking ficam velhos depois de um reload.
      setBilhetes(null);
      setBilheteAberto(null);
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
      if (!dirty.current) setDraft(ini);
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
  const encerrada = liga?.status === "finalizada";
  // Rodada não iniciada (nenhum jogo começou): o ranking segue o potencial.
  const semJogos = !!d && d.jogos.every((j) => !j.comecou);
  const minhaLinha = d?.ranking.find((r) => r.eu);

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
  const selosDe = (mid: string) => [
    ...(mid in draft.simples ? [{ label: "S", cor: C.primary }] : []),
    ...travadas.flatMap((m, i) =>
      m.pernas.some((p) => p.mercado_id === mid)
        ? [{ label: `M${i + 1}`, cor: corMultipla(i, scheme) }]
        : [],
    ),
    ...draft.multiplas.flatMap((m, i) =>
      m.mercados.includes(mid)
        ? [
            {
              label: `M${i + 1 + travadas.length}`,
              cor: corMultipla(i + travadas.length, scheme),
            },
          ]
        : [],
    ),
  ];

  const url = liga ? linkConvite(liga.convite) : "";
  const mensagem = liga
    ? `Entra no "${liga.titulo ?? `Desafio de ${liga.dono}`}" no PALPIT! ${liga.fichas_por_entrada} fichas grátis pra palpitar: ${url}`
    : "";
  const convidar = useCallback(async () => {
    const r = await compartilhar(mensagem);
    if (r === "copiado") mostrarToast("Convite copiado. É só colar pra quem você quer chamar.");
    else if (r === "falhou") mostrarToast("Não deu pra compartilhar. Copie o link.", "erro");
  }, [mensagem, mostrarToast]);
  const copiarLink = useCallback(async () => {
    const ok = await copiar(url);
    mostrarToast(ok ? "Link copiado." : "Não deu pra copiar o link.", ok ? "ok" : "erro");
  }, [url, mostrarToast]);

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
    setErroBilhete(null);
    try {
      await api.desafios.apostar(String(id), {
        simples: Object.fromEntries(
          draft.itens
            .filter((mid) => (draft.simples[mid] ?? 0) > 0)
            .map((mid) => [mid, draft.simples[mid]]),
        ),
        multiplas: draft.multiplas.filter((m) => m.mercados.length > 0),
      });
      dirty.current = false;
      setResumo(false);
      await load();
      mostrarToast("Palpites confirmados.");
    } catch (e) {
      setErroBilhete(errorMessage(e));
    }
    setSalvando(false);
  }, [id, draft, load, mostrarToast]);

  const finalizar = useCallback(async () => {
    setFinalizando(true);
    try {
      await api.desafios.finalizar(String(id));
      setConfirmaFim(false);
      await load();
    } catch (e) {
      setConfirmaFim(false);
      setErro(errorMessage(e));
    }
    setFinalizando(false);
  }, [id, load]);

  const pendentes = d?.jogos.filter((j) => !j.finalizado).length ?? 0;
  const podeBilhete = !!eu && aberta;
  const aguardando = !!liga && liga.modo === "duelo" && !encerrada && (d?.palpiteiros ?? 0) < 2;

  const resumoCard = liga ? (
    <Card className="mb-3">
      <View className="flex-row items-center">
        <View className="flex-1">
          <T className="font-mont-xb text-base" numberOfLines={1}>
            {liga.titulo ?? `Desafio de ${liga.dono}`}
          </T>
          <T className="mt-0.5 text-xs text-muted">
            de {liga.dono} · {fmtData(liga.data)} · {d!.palpiteiros}{" "}
            {d!.palpiteiros === 1 ? "palpiteiro" : "palpiteiros"}
          </T>
        </View>
        <StatusBadge status={liga.status} />
      </View>
      {eu ? (
        <View className="mt-3 flex-row" style={{ gap: 8 }}>
          {aberta ? <Kpi valor={fmtPts(livres)} rotulo="fichas livres" destaque /> : null}
          <Kpi valor={eu.posicao ? `${eu.posicao}º` : "—"} rotulo="sua posição" />
          {semJogos && !encerrada ? (
            <Kpi valor={fmtPontos(minhaLinha?.potencial ?? 0)} rotulo="potencial" />
          ) : (
            <Kpi valor={fmtPontos(eu.pontuacao)} rotulo="pontos" />
          )}
        </View>
      ) : null}
      {!user ? (
        <Button
          title="Entre na sua conta pra participar"
          variant="outline"
          className="mt-3"
          onPress={() => {
            guardarRetorno(`/desafio/${id}`);
            router.push("/entrar");
          }}
        />
      ) : d!.eu && !d!.eu.entrou && aberta ? (
        <Button
          title={`Entrar no desafio (ganha ${liga.fichas_por_entrada} fichas)`}
          className="mt-3"
          onPress={entrar}
          loading={entrando}
        />
      ) : null}
      {!encerrada && !aguardando ? (
        <View className="mt-3 flex-row" style={{ gap: 8 }}>
          <Button title="Convidar amigos" variant="outline" icon="share-social-outline" className="flex-1" compact onPress={convidar} />
          {podeCopiar ? <Button title="Copiar link" variant="ghost" compact onPress={copiarLink} /> : null}
        </View>
      ) : null}
    </Card>
  ) : null;

  const esperando = aguardando ? (
    <View className="mb-3 items-center rounded-2xl border border-dashed border-line p-4">
      <T className="font-mont-xb text-sm">Aguardando adversário</T>
      <T className="mt-1 text-center text-xs leading-4 text-muted">
        Mande o link. Quem entrar primeiro te enfrenta.{eu ? " Você já pode montar seu bilhete." : ""}
      </T>
      <View className="mt-3 w-full flex-row" style={{ gap: 6 }}>
        <View className="flex-1 justify-center rounded-lg border border-line bg-cardAlt px-2.5 py-2">
          <T className="text-[11px] text-muted" numberOfLines={1}>
            {url}
          </T>
        </View>
        {podeCopiar ? <Button title="Copiar" variant="ghost" compact onPress={copiarLink} /> : null}
      </View>
      <Button title="Enviar pelo WhatsApp" icon="logo-whatsapp" className="mt-2 self-stretch" compact onPress={() => enviarWhatsApp(mensagem)} />
    </View>
  ) : null;

  const jogoCard = (j: Jogo) => {
    const grupos = agruparMercados(j.mercados);
    const aberto = abertos.includes(j.id);
    const alternar = () => setAbertos((a) => (a.includes(j.id) ? a.filter((x) => x !== j.id) : [...a, j.id]));
    return (
      <Card key={j.id} className="mb-2">
        <Pressable className="flex-row items-center" onPress={alternar}>
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
        </Pressable>
        {liga?.e_dono && !j.finalizado && !j.externo_id ? (
          <View className="mt-2 flex-row items-center">
            <T className="mr-2 text-xs text-muted">Placar final:</T>
            <TextInput
              className="w-11 rounded border border-line px-1.5 py-1 text-center font-odds text-sm text-fg"
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
              className="w-11 rounded border border-line px-1.5 py-1 text-center font-odds text-sm text-fg"
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
              className="ml-2 rounded-lg bg-primary px-2.5 py-1.5"
            >
              <T className="text-xs text-onPrimary">Lançar</T>
            </Pressable>
          </View>
        ) : null}
        <View className="mt-1">
          {grupos
            .filter((_, gi) => gi < MERCADOS_VISIVEIS || aberto)
            .map((g) => (
              <View key={g.grupo || "_"} className="mt-2.5">
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
                          onPress={() => (pode ? marcaDraft((dr) => alternarOdd(dr, m.id)) : undefined)}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          {grupos.length > MERCADOS_VISIVEIS ? (
            <Pressable onPress={alternar} className="mt-2 flex-row items-center justify-center py-1 active:opacity-70">
              <T className="font-mont-b text-xs text-primary">
                {aberto ? "Ver menos mercados" : `Ver mais mercados (${grupos.length - MERCADOS_VISIVEIS})`}
              </T>
              <Ionicons name={aberto ? "chevron-up" : "chevron-down"} size={14} color={C.primary} />
            </Pressable>
          ) : null}
        </View>
      </Card>
    );
  };

  /** Uma linha do ranking. `compacta` = sem abrir bilhete (coluna lateral do desktop). */
  const linhaRanking = (r: RankingRow, compacta?: boolean) => {
    const aberto = !compacta && bilheteAberto === r.posicao;
    const bilhete = aberto ? bilhetes?.find((b) => b.posicao === r.posicao) : null;
    const cor = COR_POS[r.posicao] ?? C.primary;
    const valor = (
      <View className="items-end">
        {semJogos && !encerrada ? (
          <>
            <T className="font-odds text-sm" style={{ color: cor }}>{fmtPontos(r.potencial ?? 0)} pts</T>
            {compacta ? null : <T className="text-[10px] text-muted">potencial</T>}
          </>
        ) : (
          <>
            <T className="font-odds text-sm" style={{ color: cor }}>{fmtPontos(r.pontuacao)} pts</T>
            {!compacta && (r.potencial ?? r.pontuacao) > r.pontuacao ? (
              <T className="text-[10px] text-muted">pode chegar a {fmtPontos(r.potencial!)}</T>
            ) : null}
          </>
        )}
      </View>
    );
    const cabeca = (
      <View className="flex-row items-center">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-cardAlt">
          <T className="font-mont-xb text-xs">{r.posicao}º</T>
        </View>
        <T className={`ml-3 flex-1 font-mont-b text-sm ${r.eu ? "text-primary" : ""}`} numberOfLines={1}>
          {r.nome}
          {r.eu ? " (você)" : ""}
        </T>
        {valor}
        {compacta ? null : (
          <Ionicons name={aberto ? "chevron-up" : "chevron-down"} size={15} color={C.muted} style={{ marginLeft: 8 }} />
        )}
      </View>
    );
    if (compacta) {
      return (
        <View key={r.posicao} className="border-t border-line py-2">
          {cabeca}
        </View>
      );
    }
    return (
      <Pressable key={r.posicao} onPress={() => toggleBilhete(r.posicao)}>
        <Card className="mb-2 py-2">
          {cabeca}
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
  };

  const rankingLista = d && d.ranking.length > 0 ? (
    d.ranking.map((r) => linhaRanking(r))
  ) : (
    <T className="py-4 text-center text-sm text-muted">Ninguém entrou ainda.</T>
  );

  const finalizarBtn =
    liga?.e_dono && !encerrada ? (
      <Button title="Finalizar desafio" variant="danger" className="mt-4" onPress={() => setConfirmaFim(true)} />
    ) : null;

  const encerradaBloco =
    encerrada && d ? (
      <>
        {d.ranking.length > 0 ? (
          <View className="mb-1 items-center">
            <T className="font-mont-xb text-3xl">
              <T className="font-mont-xb text-3xl text-primary">{minhaLinha?.posicao ?? "—"}º</T>
              <T className="font-mont-xb text-3xl"> lugar</T>
            </T>
            <T className="mt-0.5 text-xs text-muted">
              {minhaLinha ? `${fmtPontos(minhaLinha.pontuacao)} pontos` : ""}
            </T>
          </View>
        ) : null}
        {d.ranking.length >= 2 ? (
          <View className="mb-4 flex-row items-end justify-center" style={{ gap: 10 }}>
            {[d.ranking[1], d.ranking[0], d.ranking[2]].filter(Boolean).map((r) => {
              const cor = COR_POS[r.posicao];
              const tam = r.posicao === 1 ? 56 : 44;
              return (
                <View key={r.posicao} className="w-[86px] items-center">
                  <View
                    className="items-center justify-center rounded-full bg-cardAlt"
                    style={{ width: tam, height: tam, borderWidth: 1.5, borderColor: cor }}
                  >
                    <T className="font-mont-xb" style={{ color: cor, fontSize: r.posicao === 1 ? 20 : 16 }}>
                      {r.nome[0]?.toUpperCase()}
                    </T>
                  </View>
                  <T className="mt-1 text-center font-mont-b text-[11px]" numberOfLines={1}>{r.nome}</T>
                  <T className="font-odds text-[11px]" style={{ color: cor }}>{fmtPontos(r.pontuacao)} pts</T>
                  <View
                    className="mt-1 w-full items-center rounded-t-md border border-b-0 bg-cardAlt pt-0.5"
                    style={{ height: r.posicao === 1 ? 36 : r.posicao === 2 ? 24 : 16, borderColor: cor }}
                  >
                    <T className="font-odds text-[10px]" style={{ color: cor }}>{r.posicao}</T>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
        {d.jogos.length > 0 ? (
          <Card className="mb-2">
            <Pressable className="flex-row items-center" onPress={() => router.push(`/desafio/${id}/jogos`)}>
              <T className="flex-1 font-mont-xb text-sm">Jogos</T>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </Pressable>
            {d.jogos.slice(0, maisJogos ? undefined : 2).map((j) => (
              <View key={j.id} className="mt-2 flex-row items-center border-t border-line pt-2">
                <T className="flex-1 font-mont-b text-xs">{j.time_casa} x {j.time_fora}</T>
                {j.placar ? <T className="font-odds text-sm">{j.placar.casa} - {j.placar.fora}</T> : null}
              </View>
            ))}
            {d.jogos.length > 2 ? (
              <Pressable className="mt-1 items-center pt-1" onPress={() => setMaisJogos((v) => !v)}>
                <T className="text-xs text-primary">{maisJogos ? "mostrar menos" : `ver todos os ${d.jogos.length} jogos`}</T>
              </Pressable>
            ) : null}
          </Card>
        ) : null}
        <T className="mb-2 mt-4 font-mont-xb text-xs uppercase text-muted">Ranking</T>
        {rankingLista}
      </>
    ) : null;

  const bilheteRail = podeBilhete ? (
    <Bilhete
      draft={draft}
      opcoes={opcoes}
      fichasLivres={base}
      offsetMultiplas={travadas.length}
      onChange={marcaDraft}
      rail
      alturaMax={Math.max(300, height - 190 - Math.min(d?.ranking.length ?? 0, 5) * 46)}
      onResumo={() => {
        setErroBilhete(null);
        setResumo(true);
      }}
    />
  ) : null;

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title={liga?.titulo ?? "Desafio"} back />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: !desktop && podeBilhete && draft.itens.length > 0 ? 420 : 96,
        }}
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
        <View
          style={
            desktop
              ? { maxWidth: encerrada ? 760 : 1180, width: "100%", alignSelf: "center" }
              : undefined
          }
        >
          <ErrorBox erro={erro} />
          {!d && !erro ? <Esqueleto /> : null}
          {d && encerrada ? (
            <>
              {resumoCard}
              {encerradaBloco}
            </>
          ) : null}
          {d && !encerrada && desktop ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 20 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                {resumoCard}
                {esperando}
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}>
                  {d.jogos.map((j) => (
                    <View key={j.id} style={{ width: d.jogos.length > 1 ? "50%" : "100%", paddingHorizontal: 6 }}>
                      {jogoCard(j)}
                    </View>
                  ))}
                </View>
                {finalizarBtn}
              </View>
              <View style={[{ width: 340 }, { position: "sticky", top: 16 } as object]}>
                {bilheteRail}
                <Card className={bilheteRail ? "mt-3 py-3" : "py-3"}>
                  <T className="mb-1 font-mont-xb text-[11px] uppercase tracking-widest text-muted">
                    Ranking{semJogos ? " · potencial" : ""}
                  </T>
                  {d.ranking.length > 0 ? (
                    d.ranking.slice(0, 5).map((r) => linhaRanking(r, true))
                  ) : (
                    <T className="py-3 text-center text-xs text-muted">Ninguém entrou ainda.</T>
                  )}
                  {d.ranking.length > 0 ? (
                    <Pressable onPress={() => setRankingCompleto(true)} className="border-t border-line pt-2.5">
                      <T className="text-center font-mont-b text-xs text-primary">
                        Ver ranking e bilhetes ({d.ranking.length})
                      </T>
                    </Pressable>
                  ) : null}
                </Card>
              </View>
            </View>
          ) : null}
          {d && !encerrada && !desktop ? (
            <>
              {resumoCard}
              {esperando}
              <View className="mb-3 flex-row rounded-xl bg-cardAlt p-1">
                {(["jogos", "ranking"] as const).map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => setAba(a)}
                    className={`flex-1 items-center rounded-lg py-2 ${aba === a ? "border border-line bg-card" : ""}`}
                  >
                    <T className={`font-mont-b text-xs ${aba === a ? "" : "text-muted"}`}>
                      {a === "jogos" ? `Jogos (${d.jogos.length})` : `Ranking (${d.ranking.length})`}
                    </T>
                  </Pressable>
                ))}
              </View>
              {aba === "jogos" ? (
                d.jogos.map(jogoCard)
              ) : (
                <>
                  {semJogos && d.ranking.length > 0 ? (
                    <T className="mb-2 text-xs text-muted">
                      Os jogos ainda não começaram: a ordem segue o potencial de cada bilhete.
                    </T>
                  ) : null}
                  {rankingLista}
                  {finalizarBtn}
                </>
              )}
            </>
          ) : null}
        </View>
      </ScrollView>

      {!desktop && podeBilhete && draft.itens.length > 0 ? (
        <Bilhete
          draft={draft}
          opcoes={opcoes}
          fichasLivres={base}
          offsetMultiplas={travadas.length}
          onChange={marcaDraft}
          onResumo={() => {
            setErroBilhete(null);
            setResumo(true);
          }}
        />
      ) : null}
      {podeBilhete ? (
        <ResumoBilhete
          visible={resumo}
          draft={draft}
          opcoes={opcoes}
          fichasLivres={base}
          offsetMultiplas={travadas.length}
          busy={salvando}
          erro={erroBilhete}
          onChange={marcaDraft}
          onFechar={() => setResumo(false)}
          onConfirmar={confirmar}
        />
      ) : null}

      <Confirmar
        visivel={confirmaFim}
        titulo="Finalizar desafio?"
        texto={
          pendentes > 0
            ? `${pendentes} ${pendentes === 1 ? "jogo ainda não terminou" : "jogos ainda não terminaram"}. Os palpites sem resultado contam como perdidos e o ranking é congelado.`
            : "O ranking é congelado e ninguém mais pode palpitar."
        }
        confirmar={pendentes > 0 ? "Finalizar mesmo assim" : "Finalizar"}
        perigo
        ocupado={finalizando}
        onConfirmar={finalizar}
        onFechar={() => setConfirmaFim(false)}
      />

      <Modal visible={rankingCompleto} transparent animationType="fade" onRequestClose={() => setRankingCompleto(false)}>
        <ThemeVars>
          <Pressable className="flex-1 items-center justify-center bg-black/60 p-6" onPress={() => setRankingCompleto(false)}>
            <Pressable
              className="w-full max-w-[560px] rounded-2xl bg-bg p-4"
              style={{ maxHeight: height - 80 }}
              onPress={() => {}}
            >
              <View className="mb-3 flex-row items-center">
                <T className="flex-1 font-mont-xb text-base">Ranking</T>
                <Pressable onPress={() => setRankingCompleto(false)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={C.muted} />
                </Pressable>
              </View>
              <ScrollView>{rankingLista}</ScrollView>
            </Pressable>
          </Pressable>
        </ThemeVars>
      </Modal>
    </View>
  );
}

function Kpi({ valor, rotulo, destaque }: { valor: string; rotulo: string; destaque?: boolean }) {
  return (
    <View className="flex-1 rounded-xl bg-cardAlt px-2.5 py-2">
      <T className={`font-odds text-base ${destaque ? "text-primary" : ""}`}>{valor}</T>
      <T className="text-[11px] text-muted">{rotulo}</T>
    </View>
  );
}
