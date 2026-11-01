import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import {
  alternarMultipla,
  alternarSimples,
  corMultipla,
  type Draft,
  fichasNoDraft,
  novaMultipla,
  removerPalpite,
  semGrupo,
} from "../lib/bilhete";
import { incompativeis, oddTotal, type OpcaoCompat } from "../lib/compat";
import { fmtOddExata, fmtPts } from "../lib/format";
import { ThemeVars, useTheme } from "../store/Theme";
import { Ficha } from "./Ficha";
import { Stepper } from "./Form";
import { Button, T } from "./ui";

export type OpcaoBilhete = OpcaoCompat & { id: string; jogo: string; odd: number };

/** Palpite `id` pode entrar na múltipla? (sem evento incompatível com as outras pernas) */
export function cabeNaMultipla(
  draft: Draft,
  opcoes: Record<string, OpcaoBilhete>,
  id: string,
  idx: number,
) {
  const m = draft.multiplas[idx];
  if (!m || m.mercados.includes(id)) return true;
  return !m.mercados.some((o) => incompativeis(opcoes[id], opcoes[o]));
}

export const oddDaMultipla = (ids: string[], opcoes: Record<string, OpcaoBilhete>) =>
  oddTotal(ids.map((id) => opcoes[id].odd));

/** Bilhete que sobe de baixo: 2 palpites por vez num carrossel, com os grupos e as fichas. */
export function Bilhete({
  draft,
  opcoes,
  fichasLivres,
  offsetMultiplas,
  onChange,
  onResumo,
}: {
  draft: Draft;
  opcoes: Record<string, OpcaoBilhete>;
  /** Fichas livres da entrada (antes do rascunho). */
  fichasLivres: number;
  /** Múltiplas já confirmadas: as novas continuam a numeração. */
  offsetMultiplas: number;
  onChange: (d: Draft) => void;
  onResumo: () => void;
}) {
  const { palette: C, scheme } = useTheme();
  const [aberto, setAberto] = useState(true);
  const [largura, setLargura] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [info, setInfo] = useState(false);
  const [perguntar, setPerguntar] = useState<string | null>(null);

  const livres = fichasLivres - fichasNoDraft(draft);
  const paginas: string[][] = [];
  for (let i = 0; i < draft.itens.length; i += 2) paginas.push(draft.itens.slice(i, i + 2));
  const pequena = draft.multiplas.some((m) => m.mercados.length < 2);

  const mudar = (d: Draft, id: string) => {
    onChange(d);
    if (d.itens.includes(id) && semGrupo(d, id)) setPerguntar(id);
  };

  const card = (id: string) => {
    const o = opcoes[id];
    if (!o) return null;
    const naSimples = id in draft.simples;
    const bloqueada = draft.multiplas.findIndex((_, i) => !cabeNaMultipla(draft, opcoes, id, i));
    return (
      <View key={id} className="mb-2 rounded-xl bg-cardAlt px-3 py-2">
        <View className="flex-row items-center">
          <View className="flex-1 pr-2">
            <T className="text-[10px] text-muted" numberOfLines={1}>
              {o.jogo}
            </T>
            <T className="font-mont-b text-[13px]" numberOfLines={1}>
              {o.grupo ? `${o.grupo}: ` : ""}
              {o.descricao}
            </T>
          </View>
          <T className="mr-2 font-odds text-base text-primary">{fmtOddExata(o.odd)}</T>
          <Pressable
            hitSlop={8}
            onPress={() => onChange(removerPalpite(draft, id))}
            className="h-6 w-6 items-center justify-center rounded-full bg-card"
          >
            <Ionicons name="close" size={14} color={C.muted} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
          <View className="flex-row" style={{ gap: 5 }}>
            <Chip
              label="Simples"
              cor={C.primary}
              ligado={naSimples}
              onPress={() => mudar(alternarSimples(draft, id), id)}
            />
            {draft.multiplas.map((m, i) => {
              const ok = cabeNaMultipla(draft, opcoes, id, i);
              return (
                <Chip
                  key={i}
                  label={`Múltipla ${i + 1 + offsetMultiplas}`}
                  cor={corMultipla(i + offsetMultiplas, scheme)}
                  ligado={m.mercados.includes(id)}
                  bloqueado={!ok}
                  onPress={() => mudar(alternarMultipla(draft, id, i), id)}
                />
              );
            })}
            <Pressable
              onPress={() => onChange(novaMultipla(draft, id))}
              accessibilityLabel="Nova múltipla"
              className="h-8 w-8 items-center justify-center rounded-lg border border-dashed border-line bg-card"
            >
              <Ionicons name="add" size={16} color={C.fg} />
            </Pressable>
          </View>
        </ScrollView>
        {bloqueada >= 0 ? (
          <View className="mt-1.5">
            <View className="flex-row items-center">
              <Ionicons name="warning-outline" size={14} color={C.gold} />
              <T className="ml-1 font-mont-b text-[11px]">Evento incompatível</T>
              <Pressable hitSlop={8} onPress={() => setInfo((v) => !v)} className="ml-1">
                <Ionicons name="information-circle-outline" size={16} color={C.primary} />
              </Pressable>
            </View>
            {info ? (
              <View className="mt-1 rounded-lg bg-fg p-2">
                <T className="text-[11px] leading-4 text-bg">
                  <T className="font-mont-xb text-[11px] text-bg">O que é evento incompatível? </T>
                  São dois palpites do mesmo jogo que não podem ficar na mesma múltipla, porque um anula
                  ou já garante o outro. Ex.: &quot;Coritiba vence&quot; com &quot;Mais de 0.5 gols&quot;: se o
                  Coritiba vence, já saiu gol.
                </T>
              </View>
            ) : null}
          </View>
        ) : null}
        {naSimples ? (
          <View className="mt-2 flex-row items-center justify-between">
            <T className="text-[11px] text-muted">Fichas na Simples</T>
            <Stepper
              value={draft.simples[id] ?? 0}
              max={livres}
              ficha
              editavel
              onChange={(v) => onChange({ ...draft, simples: { ...draft.simples, [id]: v } })}
            />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-line bg-card px-4 pb-4 pt-2"
      style={{ shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, elevation: 12 }}
    >
      <Pressable onPress={() => setAberto((a) => !a)} className="items-center pb-2">
        <View className="mb-2 h-1 w-10 rounded-full bg-line" />
        <View className="w-full flex-row items-center justify-between">
          <T className="font-mont-xb text-sm">
            Meu bilhete · {draft.itens.length} {draft.itens.length === 1 ? "palpite" : "palpites"}
          </T>
          <View className="flex-row items-center">
            <Ficha size={15} />
            <T className="ml-1 font-odds text-sm">{fmtPts(livres)}</T>
            <T className="ml-1 mr-2 text-xs text-muted">livres</T>
            <Ionicons name={aberto ? "chevron-down" : "chevron-up"} size={18} color={C.muted} />
          </View>
        </View>
      </Pressable>
      {aberto ? (
        <>
          <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
            {largura > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => setPagina(Math.round(e.nativeEvent.contentOffset.x / largura))}
                scrollEventThrottle={32}
              >
                {paginas.map((p, i) => (
                  <View key={i} style={{ width: largura }}>
                    {p.map(card)}
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
          {paginas.length > 1 ? (
            <View className="mb-2 flex-row items-center justify-center" style={{ gap: 5 }}>
              {paginas.map((_, i) => (
                <View
                  key={i}
                  className={`h-1.5 rounded-full ${i === pagina ? "w-4 bg-primary" : "w-1.5 bg-line"}`}
                />
              ))}
              <T className="ml-1.5 text-[10px] text-muted">deslize pra ver todos</T>
            </View>
          ) : null}
          {draft.multiplas.map((m, i) => {
            const cor = corMultipla(i + offsetMultiplas, scheme);
            const curta = m.mercados.length < 2;
            return (
              <View key={i}>
                <View
                  className="mb-1.5 flex-row items-center rounded-xl px-2 py-1.5"
                  style={{
                    borderWidth: 1.5,
                    borderStyle: curta ? "dashed" : "solid",
                    borderColor: cor,
                  }}
                >
                  <View className="rounded-md px-1.5 py-0.5" style={{ backgroundColor: cor }}>
                    <T className="font-mont-xb text-[10px] text-white">M{i + 1 + offsetMultiplas}</T>
                  </View>
                  <T className="ml-2 flex-1 text-[11px] text-muted" numberOfLines={1}>
                    {m.mercados.length} {m.mercados.length === 1 ? "palpite" : "palpites"} · odd{" "}
                    <T className="font-mont-xb text-[12px]" style={{ color: cor }}>
                      {fmtOddExata(oddDaMultipla(m.mercados, opcoes))}
                    </T>
                  </T>
                  <Stepper
                    value={m.fichas}
                    max={livres}
                    ficha
                    editavel
                    onChange={(v) =>
                      onChange({
                        ...draft,
                        multiplas: draft.multiplas.map((x, k) => (k === i ? { ...x, fichas: v } : x)),
                      })
                    }
                  />
                </View>
                {curta ? (
                  <View className="mb-1.5 flex-row items-center">
                    <Ionicons name="warning-outline" size={14} color={C.gold} />
                    <T className="ml-1 font-mont-b text-[11px]">Múltipla precisa de pelo menos 2 palpites</T>
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}
      <Button title="Ver resumo" onPress={onResumo} disabled={pequena} className="mt-1" />

      <Modal visible={!!perguntar} transparent animationType="fade" onRequestClose={() => setPerguntar(null)}>
        <ThemeVars>
          <View className="flex-1 items-center justify-center bg-black/60 px-5">
            <View className="w-full max-w-[420px] rounded-2xl bg-card p-5">
              <T className="font-mont-xb text-lg">Deseja remover este palpite?</T>
              <T className="mt-1 text-sm text-muted">
                &quot;{perguntar ? opcoes[perguntar]?.descricao : ""}&quot; ficou fora da Simples e das múltiplas.
              </T>
              <Button
                title="Remover palpite"
                className="mt-4"
                onPress={() => {
                  if (perguntar) onChange(removerPalpite(draft, perguntar));
                  setPerguntar(null);
                }}
              />
              <Button title="Manter no bilhete" variant="ghost" className="mt-2" onPress={() => setPerguntar(null)} />
            </View>
          </View>
        </ThemeVars>
      </Modal>
    </View>
  );
}

function Chip({
  label,
  cor,
  ligado,
  bloqueado,
  onPress,
}: {
  label: string;
  cor: string;
  ligado: boolean;
  bloqueado?: boolean;
  onPress: () => void;
}) {
  const { palette: C } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={bloqueado}
      className={`h-8 flex-row items-center rounded-lg px-3 ${bloqueado ? "border border-dashed border-line" : "border"}`}
      style={
        bloqueado
          ? { backgroundColor: C.cardAlt }
          : { backgroundColor: ligado ? cor : C.card, borderColor: ligado ? cor : C.line }
      }
    >
      {bloqueado ? <Ionicons name="warning-outline" size={12} color={C.gold} style={{ marginRight: 3 }} /> : null}
      <T
        className={`font-mont-b text-[11px] ${ligado ? "text-white" : "text-muted"}`}
        style={bloqueado ? { textDecorationLine: "line-through" } : undefined}
      >
        {label}
      </T>
    </Pressable>
  );
}
