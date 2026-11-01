import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, View } from "react-native";

import { fmtPts } from "../lib/format";
import { ThemeVars, useTheme } from "../store/Theme";
import { Ficha } from "./Ficha";
import { Button, T } from "./ui";

export function EntradaModal({
  visible,
  custo,
  fichas,
  saldo,
  busy,
  onConfirmar,
  onFechar,
}: {
  visible: boolean;
  custo: number;
  fichas: number;
  saldo: number;
  busy?: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}) {
  const { palette: C } = useTheme();
  const semSaldo = saldo < custo;
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
                texto="Cada palpite certo multiplica suas fichas pela odd. Quem somar mais pontos leva o prêmio."
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
