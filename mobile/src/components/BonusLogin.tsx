import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { Modal, View } from "react-native";

import { fmtPts } from "../lib/format";
import { useApp } from "../store/AppStore";
import { T } from "./ui";

const SEGUNDOS_NA_TELA = 3;

/** Prêmio de login diário do Premium: aparece por 3s e os PONTOS vão para a carteira. */
export function BonusLogin() {
  const { session, user, receberBonusLogin } = useApp();
  const valor = session.bonusLogin;
  const visible = valor > 0 && !!user;

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(receberBonusLogin, SEGUNDOS_NA_TELA * 1000);
    return () => clearTimeout(t);
  }, [visible, receberBonusLogin]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/60 px-8">
        <View className="w-full items-center rounded-3xl bg-card px-6 py-8">
          <View className="rounded-full bg-gold/20 px-3 py-1">
            <T className="font-mont-b text-[10px] tracking-widest text-gold">
              PREMIUM
            </T>
          </View>
          <View className="mt-5 h-20 w-20 items-center justify-center rounded-full bg-primary/15">
            <Ionicons name="gift" size={40} color="#FFC94D" />
          </View>
          <T className="mt-5 font-odds text-4xl text-primary">
            +{fmtPts(valor)} PONTOS
          </T>
          <T className="mt-2 font-mont-xb text-base text-fg">
            Bônus de login diário
          </T>
          <T className="mt-1 text-center text-xs text-muted">
            Valeu por entrar hoje! Os pontos vão direto para a sua carteira.
          </T>
        </View>
      </View>
    </Modal>
  );
}
