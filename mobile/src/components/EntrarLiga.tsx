import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { FICHAS_POR_LIGA } from "../lib/constants";
import { fmtPts } from "../lib/format";
import { errorMessage, useApp } from "../store/AppStore";
import type { Liga } from "../types";
import { ConfirmModal } from "./Modals";
import { T } from "./ui";

/** Fluxo de entrada: paga custo_entrada em PONTOS -> recebe FICHAS dentro da liga. */
export function useEntrarLiga() {
  const { user, entrarNaLiga } = useApp();
  const [liga, setLiga] = useState<Liga | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const fechar = () => {
    setLiga(null);
    setErro(null);
  };

  const confirmar = () => {
    if (!liga) return;
    try {
      entrarNaLiga(liga.id);
      const id = liga.id;
      fechar();
      router.push({ pathname: "/liga/[id]", params: { id } });
    } catch (e) {
      setErro(errorMessage(e));
    }
  };

  const saldo = user?.saldo_pontos ?? 0;
  const modal = (
    <ConfirmModal
      visible={!!liga}
      title={liga?.nome_jogo ?? ""}
      confirmLabel={`Pagar ${liga?.custo_entrada ?? 0} PONTOS e entrar`}
      error={erro}
      onConfirm={confirmar}
      onClose={fechar}
      message={
        liga ? (
          <View>
            <View className="flex-row justify-between rounded-xl bg-cardAlt p-3">
              <View>
                <T className="text-[10px] uppercase tracking-widest text-muted">
                  Você paga
                </T>
                <T className="font-odds text-xl text-danger">
                  -{fmtPts(liga.custo_entrada)} PONTOS
                </T>
              </View>
              <View className="items-end">
                <T className="text-[10px] uppercase tracking-widest text-muted">
                  Você recebe
                </T>
                <T className="font-odds text-xl text-primary">
                  {FICHAS_POR_LIGA} FICHAS
                </T>
              </View>
            </View>
            <T className="mt-3 text-xs leading-5 text-white/70">
              PONTOS são o saldo do seu perfil. FICHAS só valem dentro deste
              palpite: distribua nos mercados e suba no ranking. O 1º lugar
              recebe os PONTOS de volta + o prêmio.
            </T>
            <T className="mt-3 font-mont-sb text-xs text-muted">
              Saldo atual: {fmtPts(saldo)} → após entrada:{" "}
              {fmtPts(saldo - liga.custo_entrada)} PONTOS
            </T>
          </View>
        ) : null
      }
    />
  );

  return { abrir: (l: Liga) => setLiga(l), modal };
}
