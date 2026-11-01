import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { corMultipla, type Draft, fichasNoDraft } from "../lib/bilhete";
import { exato } from "../lib/compat";
import { fmtExato, fmtOddExata, fmtPts } from "../lib/format";
import { ThemeVars, useTheme } from "../store/Theme";
import { oddDaMultipla, type OpcaoBilhete } from "./Bilhete";
import { ErrorBox, Stepper } from "./Form";
import { Button, T } from "./ui";

/** Tela D: resumo agrupado (Simples e cada Múltipla), ainda editável, antes de confirmar. */
export function ResumoBilhete({
  visible,
  draft,
  opcoes,
  fichasLivres,
  offsetMultiplas,
  busy,
  erro,
  onChange,
  onFechar,
  onConfirmar,
}: {
  visible: boolean;
  draft: Draft;
  opcoes: Record<string, OpcaoBilhete>;
  fichasLivres: number;
  offsetMultiplas: number;
  busy: boolean;
  erro: string | null;
  onChange: (d: Draft) => void;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  const { palette: C, scheme } = useTheme();
  const [sobra, setSobra] = useState(false);
  const usadas = fichasNoDraft(draft);
  const livres = fichasLivres - usadas;
  const simples = draft.itens.filter((id) => id in draft.simples && opcoes[id]);
  const totalSimples = simples.reduce((s, id) => s + (draft.simples[id] ?? 0), 0);
  const retSimples = exato(simples.reduce((s, id) => s + (draft.simples[id] ?? 0) * opcoes[id].odd, 0));
  const mults = draft.multiplas.map((m, i) => {
    const odd = oddDaMultipla(m.mercados, opcoes);
    return { ...m, i, odd, cor: corMultipla(i + offsetMultiplas, scheme), ret: exato(m.fichas * odd) };
  });
  const retMax = exato(retSimples + mults.reduce((s, m) => s + m.ret, 0));
  const invalida = draft.multiplas.some((m) => m.mercados.length < 2);
  const semFichasMult = draft.multiplas.some((m) => m.fichas <= 0);
  const podeConfirmar = usadas > 0 && !invalida && !semFichasMult;

  const setMult = (i: number, v: number) =>
    onChange({ ...draft, multiplas: draft.multiplas.map((x, k) => (k === i ? { ...x, fichas: v } : x)) });

  const segmentos = [
    { cor: C.primary, n: totalSimples, label: "Simples" },
    ...mults.map((m) => ({ cor: m.cor, n: m.fichas, label: `Múltipla ${m.i + 1 + offsetMultiplas}` })),
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onFechar}>
      <ThemeVars>
        <View className="flex-1 bg-bg">
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <T className="font-mont-xb text-2xl">Resumo do bilhete</T>
            <T className="mb-3 text-xs text-muted">Rodada do dia · confira e ajuste antes de confirmar</T>

            <View className="mb-3 rounded-2xl border border-line bg-card p-3">
              <View className="flex-row items-center justify-between">
                <T className="font-mont-b text-sm">Onde estão suas fichas</T>
                <T className="font-odds text-sm">
                  {fmtPts(usadas)} / {fmtPts(fichasLivres)}
                </T>
              </View>
              <View className="my-2 h-2 flex-row overflow-hidden rounded-full bg-cardAlt" style={{ gap: 2 }}>
                {segmentos
                  .filter((s) => s.n > 0)
                  .map((s) => (
                    <View key={s.label} style={{ flex: s.n, backgroundColor: s.cor }} />
                  ))}
                {livres > 0 ? <View style={{ flex: livres }} /> : null}
              </View>
              <View className="flex-row flex-wrap" style={{ columnGap: 10, rowGap: 2 }}>
                {segmentos.map((s) => (
                  <T key={s.label} className="font-mont-b text-[11px]" style={{ color: s.cor }}>
                    ■ {s.label} <T className="font-mont-xb text-[11px]">{fmtPts(s.n)}</T>
                  </T>
                ))}
                {livres > 0 ? (
                  <T className="font-mont-b text-[11px] text-muted">
                    ■ Livres <T className="font-mont-xb text-[11px]">{fmtPts(livres)}</T>
                  </T>
                ) : null}
              </View>
            </View>

            {simples.length > 0 ? (
              <Grupo titulo="SIMPLES" legenda="cada palpite vale por si só" cor={C.primary}>
                {simples.map((id, k) => {
                  const o = opcoes[id];
                  const f = draft.simples[id] ?? 0;
                  return (
                    <View key={id} className={`px-3 py-2 ${k ? "border-t border-line" : ""}`}>
                      <View className="flex-row items-center">
                        <View className="flex-1 pr-2">
                          <T className="text-[10px] text-muted">{o.jogo}</T>
                          <T className="font-mont-b text-[13px]">{o.descricao}</T>
                        </View>
                        <T className="font-odds text-base" style={{ color: C.primary }}>
                          {fmtOddExata(o.odd)}
                        </T>
                      </View>
                      <View className="mt-1 flex-row items-center justify-between">
                        <Stepper
                          value={f}
                          max={livres}
                          ficha
                          editavel
                          onChange={(v) => onChange({ ...draft, simples: { ...draft.simples, [id]: v } })}
                        />
                        <T className="text-[11px] text-muted">
                          {f} × {o.odd.toFixed(2)} →{" "}
                          <T className="font-mont-xb text-xs text-primary">{fmtExato(exato(f * o.odd))}</T>
                        </T>
                      </View>
                    </View>
                  );
                })}
              </Grupo>
            ) : null}

            {mults.map((m) => (
              <Grupo
                key={m.i}
                titulo={`MÚLTIPLA ${m.i + 1 + offsetMultiplas}`}
                legenda="todas precisam bater"
                cor={m.cor}
                rodape={
                  <View className="mt-2 flex-row items-center justify-between">
                    <Stepper value={m.fichas} max={livres} ficha editavel onChange={(v) => setMult(m.i, v)} />
                    <T className="text-[11px] text-muted">
                      {m.fichas} × {fmtOddExata(m.odd).slice(0, -1)} →{" "}
                      <T className="font-mont-xb text-sm text-primary">{fmtExato(m.ret)}</T>
                    </T>
                  </View>
                }
              >
                {m.mercados.map((id, k) => {
                  const o = opcoes[id];
                  return (
                    <View key={id} className={`flex-row items-center px-3 py-2 ${k ? "border-t border-line" : ""}`}>
                      <View className="flex-1 pr-2">
                        <T className="text-[10px] text-muted">{o.jogo}</T>
                        <T className="font-mont-b text-[13px]">{o.descricao}</T>
                      </View>
                      <T className="font-odds text-base" style={{ color: m.cor }}>
                        <T className="text-xs text-muted">{k ? "× " : ""}</T>
                        {o.odd.toFixed(2)}
                      </T>
                    </View>
                  );
                })}
                <View className="flex-row items-center border-t border-line px-3 py-2" style={{ backgroundColor: m.cor + "18" }}>
                  <T className="flex-1 font-mont-xb text-[10px] tracking-widest text-muted">ODD TOTAL</T>
                  <T className="font-odds text-lg" style={{ color: m.cor }}>
                    <T className="text-xs text-muted">= </T>
                    {fmtOddExata(m.odd).slice(0, -1)}
                  </T>
                </View>
                {m.mercados.length < 2 ? (
                  <View className="flex-row items-center px-3 pb-2">
                    <Ionicons name="warning-outline" size={14} color={C.gold} />
                    <T className="ml-1 font-mont-b text-[11px]">Múltipla precisa de pelo menos 2 palpites</T>
                  </View>
                ) : null}
              </Grupo>
            ))}

            <View className="mb-3 rounded-2xl border border-line bg-card p-3">
              {simples.length > 0 ? (
                <Linha label="Simples" cor={C.primary} fichas={totalSimples} texto="até" valor={retSimples} />
              ) : null}
              {mults.map((m) => (
                <Linha
                  key={m.i}
                  label={`Múltipla ${m.i + 1 + offsetMultiplas}`}
                  cor={m.cor}
                  fichas={m.fichas}
                  texto="se todas baterem"
                  valor={m.ret}
                />
              ))}
              <View className="mt-2 flex-row items-center justify-between border-t border-line pt-2">
                <T className="font-mont-b text-xs text-muted">Retorno máximo</T>
                <T className="font-odds text-2xl text-primary">{fmtExato(retMax)}</T>
              </View>
            </View>

            {semFichasMult ? (
              <T className="mb-2 text-center text-xs text-muted">Coloque fichas em cada múltipla pra confirmar.</T>
            ) : null}
            <ErrorBox erro={erro} />
            <Button
              title="Confirmar bilhete"
              className="mt-2"
              loading={busy}
              disabled={!podeConfirmar}
              onPress={() => (livres > 0 ? setSobra(true) : onConfirmar())}
            />
            <Button title="Voltar e editar" variant="ghost" className="mt-2" onPress={onFechar} />
          </ScrollView>

          {sobra ? (
            <Pressable className="absolute inset-0 items-center justify-center bg-black/60 px-5" onPress={() => setSobra(false)}>
              <Pressable className="w-full max-w-[420px] rounded-2xl bg-card p-5" onPress={() => {}}>
                <T className="font-mont-xb text-lg">Ainda sobraram fichas</T>
                <T className="mt-1 text-sm text-muted">
                  Você ainda tem {fmtPts(livres)} fichas para distribuir. Deseja finalizar mesmo assim ou distribuir o
                  restante?
                </T>
                <Button title="Distribuir o restante" className="mt-4" onPress={() => setSobra(false)} />
                <Button
                  title="Finalizar assim mesmo"
                  variant="ghost"
                  className="mt-2"
                  onPress={() => {
                    setSobra(false);
                    onConfirmar();
                  }}
                />
              </Pressable>
            </Pressable>
          ) : null}
        </View>
      </ThemeVars>
    </Modal>
  );
}

function Grupo({
  titulo,
  legenda,
  cor,
  children,
  rodape,
}: {
  titulo: string;
  legenda: string;
  cor: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <View className="mb-3 rounded-2xl p-2.5" style={{ borderWidth: 1.5, borderColor: cor, backgroundColor: cor + "0F" }}>
      <View className="mb-2 flex-row items-center justify-between">
        <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: cor }}>
          <T className="font-mont-xb text-[11px] tracking-widest text-white">{titulo}</T>
        </View>
        <T className="text-[10px] text-muted">{legenda}</T>
      </View>
      <View className="overflow-hidden rounded-xl border border-line bg-card">{children}</View>
      {rodape}
    </View>
  );
}

function Linha({
  label,
  cor,
  fichas,
  texto,
  valor,
}: {
  label: string;
  cor: string;
  fichas: number;
  texto: string;
  valor: number;
}) {
  return (
    <View className="flex-row items-center justify-between py-0.5">
      <T className="font-mont-b text-xs" style={{ color: cor }}>
        {label}
      </T>
      <T className="text-xs text-muted">
        <T className="font-mont-xb text-xs">{fmtPts(fichas)}</T> · {texto}{" "}
        <T className="font-mont-xb text-xs text-primary">{fmtExato(valor)}</T>
      </T>
    </View>
  );
}
