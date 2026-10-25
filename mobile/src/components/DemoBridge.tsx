import { router, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { useApp } from "../store/AppStore";

/**
 * Ponte para o deck de apresentação (web): quando o app roda dentro de um
 * iframe, o deck controla a navegação e o estado da demo via postMessage.
 */
type Comando =
  | { type: "palpitei:ensureUser" }
  | { type: "palpitei:navigate"; path: string }
  | { type: "palpitei:openApp" }
  | { type: "palpitei:premium"; value: boolean }
  | { type: "palpitei:reset" };

const DEMO_USER = { name: "Vitória Hendrica", whatsapp: "85999990000", bairro: "Aldeota" };

const embutido = Platform.OS === "web" && typeof window !== "undefined" && window.parent !== window;

export function DemoBridge() {
  const app = useApp();
  const ref = useRef(app);
  useEffect(() => {
    ref.current = app;
  });

  const temUser = !!app.user;
  const premium = !!app.user?.is_premium;

  useEffect(() => {
    if (!embutido) return;
    window.parent.postMessage({ type: "palpitei:state", hasUser: temUser, premium }, window.location.origin);
  }, [temUser, premium]);

  useEffect(() => {
    if (!embutido) return;
    const onMessage = (e: MessageEvent<Comando>) => {
      if (e.origin !== window.location.origin || !e.data?.type) return;
      const a = ref.current;
      switch (e.data.type) {
        case "palpitei:ensureUser":
          if (!a.user) a.onboard(DEMO_USER);
          a.fecharInterstitial();
          break;
        case "palpitei:navigate":
          if (a.user) router.navigate(e.data.path as Href);
          break;
        case "palpitei:openApp":
          a.reabrirApp();
          break;
        case "palpitei:premium":
          if (a.user) a.setPremium(e.data.value);
          break;
        case "palpitei:reset":
          void a.resetDemo();
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
