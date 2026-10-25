import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Linking,
  Modal,
  Pressable,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "../store/AppStore";
import type { Anuncio } from "../types";
import { T } from "./ui";

const IMAGENS_LOCAIS: Record<string, ImageSourcePropType> = {
  "local:flores": require("../../assets/ads/flores.jpg"),
};

function AdImage({ ad, className }: { ad: Anuncio; className: string }) {
  const [erro, setErro] = useState(false);
  if (erro) {
    return (
      <View className={`items-center justify-center bg-cardAlt ${className}`}>
        <T className="font-mont-xb text-lg text-primary">{ad.anunciante}</T>
        <T className="mt-1 text-xs text-muted">Toque para saber mais</T>
      </View>
    );
  }
  return (
    <Image
      source={IMAGENS_LOCAIS[ad.imagem_url] ?? { uri: ad.imagem_url }}
      className={className}
      style={{ width: "100%", height: "100%" }}
      resizeMode="cover"
      onError={() => setErro(true)}
    />
  );
}

/** Banner 320x100 fixo no rodapé. Sorteado 1x por sessão no AppStore. Premium não vê. */
export function FooterBanner() {
  const { session, user } = useApp();
  const ad = session.banner;
  if (!ad || !user || user.is_premium) return null;
  return (
    <View className="items-center border-t border-card bg-bg py-1.5">
      <Pressable
        onPress={() => Linking.openURL(ad.link)}
        style={{ width: 320, height: 100 }}
        className="overflow-hidden rounded-md"
      >
        <AdImage ad={ad} className="h-full w-full" />
        <View className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5">
          <T className="font-mont-b text-[9px] text-white/80">ANÚNCIO</T>
        </View>
      </Pressable>
    </View>
  );
}

const SEGUNDOS_PARA_FECHAR = 3;

/** Interstitial full-screen mostrado ao abrir o app. Premium não vê. */
export function Interstitial() {
  const { session, user, fecharInterstitial } = useApp();
  const insets = useSafeAreaInsets();
  const ad = session.interstitial;
  const visible =
    !!ad && !!user && !user.is_premium && !session.interstitialVisto;
  const [restante, setRestante] = useState(SEGUNDOS_PARA_FECHAR);
  const [visivelAntes, setVisivelAntes] = useState(visible);
  if (visible !== visivelAntes) {
    setVisivelAntes(visible);
    if (visible) setRestante(SEGUNDOS_PARA_FECHAR);
  }

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(
      () => setRestante((s) => (s <= 1 ? (clearInterval(t), 0) : s - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, [visible]);

  if (!ad) return null;
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={() => {
        if (restante === 0) fecharInterstitial();
      }}
    >
      <View className="flex-1 bg-black">
        <Pressable className="flex-1" onPress={() => Linking.openURL(ad.link)}>
          <AdImage ad={ad} className="h-full w-full" />
        </Pressable>
        <View
          style={{ top: insets.top + 12 }}
          className="absolute left-4 rounded bg-black/60 px-2 py-1"
        >
          <T className="font-mont-b text-[10px] text-white/80">
            ANÚNCIO • {ad.anunciante}
          </T>
        </View>
        <Pressable
          onPress={fecharInterstitial}
          disabled={restante > 0}
          style={{ top: insets.top + 8 }}
          className="absolute right-4 h-10 w-10 items-center justify-center rounded-full bg-black/70"
        >
          {restante > 0 ? (
            <T className="font-odds text-base text-white">{restante}</T>
          ) : (
            <Ionicons name="close" size={22} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </Modal>
  );
}
