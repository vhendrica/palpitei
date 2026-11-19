import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Modal, Pressable, View } from "react-native";

import { fmtPts } from "../lib/format";
import { ThemeVars, useTheme } from "../store/Theme";
import { Ficha } from "./Ficha";
import { Button, T } from "./ui";

/** Mesma curva do bônus de login do backend (dias 1 a 7). */
const CURVA_LOGIN = [40, 50, 60, 70, 80, 90, 110];

export function EntradaModal({
  visible,
  custo,
  fichas,
  saldo,
  streak = 0,
  busy,
  onConfirmar,
  onFechar,
}: {
  visible: boolean;
  custo: number;
  fichas: number;
  saldo: number;
  /** Dias seguidos de login (pra dizer quanto a sequência rende amanhã). */
  streak?: number;
  busy?: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}) {
  const { palette: C } = useTheme();
  const semSaldo = saldo < custo;
  if (semSaldo) {
    // Depois do 7º dia o ciclo recomeça no dia 1.
    const proximo = streak >= 7 || streak < 1 ? 1 : streak + 1;
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onFechar}>
        <ThemeVars>
          <Pressable className="flex-1 items-center justify-center bg-black/60 px-5" onPress={onFechar}>
            <Pressable className="w-full max-w-[420px] rounded-2xl bg-card p-5" onPress={() => {}}>
              <T className="font-mont-xb text-lg">Faltam {fmtPts(custo - saldo)} PONTOS</T>
              <T className="mt-1 text-xs leading-4 text-muted">
                A entrada custa {fmtPts(custo)} PONTOS e você tem {fmtPts(saldo)}. Dá para completar assim:
              </T>
              <View className="mt-3 flex-row items-center rounded-xl bg-cardAlt p-3">
                <View className="flex-1">
                  <T className="font-mont-b text-xs">Sequência diária</T>
                  <T className="text-[11px] text-muted">Abra o app amanhã (dia {proximo} de 7)</T>
                </View>
                <T className="font-odds text-sm text-primary">+{CURVA_LOGIN[proximo - 1]}</T>
              </View>
              <View className="mt-2 flex-row items-center rounded-xl bg-cardAlt p-3">
                <View className="flex-1">
                  <T className="font-mont-b text-xs">Desafios entre amigos</T>
                  <T className="text-[11px] text-muted">Entrada grátis, não usa PONTOS</T>
                </View>
                <T className="font-odds text-sm text-primary">grátis</T>
              </View>
              <Button
                title="Ver desafios"
                className="mt-4"
                onPress={() => {
                  onFechar();
                  router.push("/(tabs)/desafio");
                }}
              />
              <Button title="Agora não" variant="ghost" onPress={onFechar} className="mt-1" />
            </Pressable>
          </Pressable>
        </ThemeVars>
      </Modal>
    );
  }
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      <ThemeVars>
        <Pressable
          className="flex-1 items-center justify-center bg-black/60 px-5"
          onPress={onFechar}
        >
          <Pressable
            className="w-full max-w-[420px] rounded-2xl bg-card p-5"
            onPress={() => {}}
          >
            <T className="text-center font-mont-xb text-lg">Bora palpitar!</T>
            <T className="mt-1 text-center text-xs text-muted">
              Troque seus PONTOS por FICHAS pra jogar a rodada.
            </T>

            <View className="mt-4 flex-row items-center justify-center">
              <View className="items-center rounded-xl border border-line px-4 py-3">
                <Ionicons name="wallet-outline" size={26} color={C.muted} />
                <T className="mt-1 font-odds text-2xl">{custo}</T>
                <T className="text-[10px] uppercase tracking-widest text-muted">
                  pontos
                </T>
              </View>
              <Ionicons
                name="arrow-forward"
                size={22}
                color={C.primary}
                style={{ marginHorizontal: 12 }}
              />
              <View className="items-center rounded-xl border-2 border-primary px-4 py-3">
                <Ficha size={26} />
                <T className="mt-1 font-odds text-2xl text-primary">{fichas}</T>
                <T className="text-[10px] uppercase tracking-widest text-primary">
                  fichas
                </T>
              </View>
            </View>

            <View className="mt-4 gap-2">
              <Passo n={1} texto="Escolha os mercados nos jogos da rodada." />
              <Passo
                n={2}
                texto={`Distribua suas ${fichas} fichas como quiser entre eles.`}
              />
              <Passo
                n={3}
                texto="Cada palpite certo multiplica suas fichas pelo multiplicador. Quem somar mais pontos leva o prêmio."
              />
            </View>

            <View className="mt-4 flex-row items-center justify-between rounded-xl bg-bg px-3 py-2">
              <T className="text-xs text-muted">Seu saldo</T>
              <T className="font-mont-b text-sm">
                {fmtPts(saldo)} → {fmtPts(Math.max(0, saldo - custo))} PONTOS
              </T>
            </View>
            {semSaldo ? (
              <T className="mt-2 text-center text-xs text-danger">
                Saldo insuficiente pra entrar.
              </T>
            ) : null}

            <Button
              title="Palpitar agora"
              icon="football"
              onPress={onConfirmar}
              loading={busy}
              disabled={semSaldo}
              className="mt-4"
            />
            <Button
              title="Agora não"
              variant="ghost"
              onPress={onFechar}
              className="mt-1"
            />
          </Pressable>
        </Pressable>
      </ThemeVars>
    </Modal>
  );
}

function Passo({ n, texto }: { n: number; texto: string }) {
  return (
    <View className="flex-row items-start">
      <View className="mr-2 h-5 w-5 items-center justify-center rounded-full bg-primary">
        <T className="font-mont-xb text-[11px] text-white">{n}</T>
      </View>
      <T className="flex-1 text-sm">{texto}</T>
    </View>
  );
}
