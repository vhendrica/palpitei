import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { fmtOdd, fmtPts } from "../lib/format";
import { useTheme } from "../store/Theme";
import { Ficha } from "./Ficha";
import { ErrorBox, Stepper } from "./Form";
import { Button, T } from "./ui";

export type ItemBilhete = {
  id: string;
  jogo: string;
  grupo: string;
  descricao: string;
  multiplicador: number;
  fichas: number;
};

/** Cupom de aposta que sobe de baixo: escolhas, fichas de cada uma, total e confirmar. */
export function Bilhete({
  itens,
  livres,
  busy,
  erro,
  onChange,
  onRemove,
  onConfirmar,
}: {
  itens: ItemBilhete[];
  livres: number;
  busy: boolean;
  erro: string | null;
  onChange: (id: string, fichas: number) => void;
  onRemove: (id: string) => void;
  onConfirmar: () => void;
}) {
  const { palette: C } = useTheme();
  const [aberto, setAberto] = useState(true);
  const total = itens.reduce((s, i) => s + i.fichas, 0);
  const retorno = itens.reduce((s, i) => s + i.fichas * i.multiplicador, 0);

  return (
    <View
      className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-line bg-card px-4 pb-4 pt-2"
      style={{ shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, elevation: 12 }}
    >
      <Pressable onPress={() => setAberto((a) => !a)} className="items-center pb-2">
        <View className="mb-2 h-1 w-10 rounded-full bg-line" />
        <View className="w-full flex-row items-center justify-between">
          <T className="font-mont-xb text-sm">
            Meu bilhete · {itens.length} {itens.length === 1 ? "escolha" : "escolhas"}
          </T>
          <View className="flex-row items-center">
            <T className="font-odds text-base text-primary">{fmtPts(livres)}</T>
            <View className="mx-1">
              <Ficha size={16} />
            </View>
            <T className="mr-2 text-xs text-muted">livres</T>
            <Ionicons name={aberto ? "chevron-down" : "chevron-up"} size={18} color={C.muted} />
          </View>
        </View>
      </Pressable>

      {aberto ? (
        <ScrollView style={{ maxHeight: 260 }}>
          {itens.map((i) => (
            <View key={i.id} className="flex-row items-center border-b border-line py-2.5">
              <Pressable onPress={() => onRemove(i.id)} hitSlop={8} className="mr-2">
                <Ionicons name="close-circle" size={20} color={C.muted} />
              </Pressable>
              <View className="flex-1 pr-2">
                <T className="font-mont-b text-[13px]" numberOfLines={1}>
                  {i.grupo ? `${i.grupo}: ` : ""}
                  {i.descricao}
                </T>
                <T className="text-[11px] text-muted" numberOfLines={1}>
                  {i.jogo} · <T className="font-odds text-[11px] text-primary">{fmtOdd(i.multiplicador)}</T>
                </T>
              </View>
              <Stepper
                value={i.fichas}
                max={livres}
                ficha
                editavel
                onChange={(v) => onChange(i.id, v)}
              />
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View className="mt-2 flex-row items-center justify-between">
        <T className="text-xs text-muted">Se acertar tudo</T>
        <T className="font-odds text-base">{fmtPts(Math.round(retorno * 100) / 100)} pts</T>
      </View>
      <ErrorBox erro={erro} />
      <Button
        title={total > 0 ? `Confirmar ${total} fichas` : "Coloque fichas nas escolhas"}
        onPress={onConfirmar}
        loading={busy}
        disabled={total <= 0}
        className="mt-3"
      />
    </View>
  );
}
