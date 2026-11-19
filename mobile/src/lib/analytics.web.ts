import { posthog } from "posthog-js";

/**
 * Versão web do analytics (mesma API de ./analytics.ts — o Metro escolhe
 * este arquivo automaticamente no bundle web). Sem chave = no-op.
 */

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export const analyticsOk = KEY.startsWith("phc_");

if (analyticsOk && typeof window !== "undefined") {
  posthog.init(KEY, {
    api_host: HOST,
    // Sem perfil anônimo: pessoa só existe depois do identify (login).
    person_profiles: "identified_only",
    // Pageviews entram como "$screen" pelo router, pra casar com o app nativo.
    capture_pageview: false,
    // Sem eventos genéricos ("clicked div") nem web vitals: só o que a gente manda.
    autocapture: false,
    capture_performance: false,
    // Coleta cliques só pro Heatmap do PostHog — não vira evento no Activity.
    capture_heatmaps: true,
    // Error tracking: erros JS não tratados viram $exception.
    capture_exceptions: true,
  });
}

type Props = Record<string, string | number | boolean | null | undefined>;

const LITERAIS = new Set([
  "desafio",
  "jogos",
  "convite",
  "criar",
  "historico",
  "palpiteiros",
  "admin-palpiteiros",
  "simulador",
  "entrar",
  "cadastro",
  "codigo",
]);

export function nomeTela(pathname: string): string {
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return "home";
  return "/" + segs.map((s) => (LITERAIS.has(s) ? s : ":id")).join("/");
}

export function track(evento: string, props?: Props) {
  try {
    if (analyticsOk) posthog.capture(evento, props);
  } catch {
    /* analytics nunca derruba o app */
  }
}

export function trackScreen(pathname: string) {
  try {
    if (analyticsOk) posthog.capture("$screen", { $screen_name: nomeTela(pathname) });
  } catch {
    /* analytics nunca derruba o app */
  }
}

export function identifyUser(u: { id: string; bairro?: string | null } | null) {
  try {
    if (u && analyticsOk) posthog.identify(u.id, { bairro: u.bairro ?? null });
  } catch {
    /* analytics nunca derruba o app */
  }
}

/** Erro esperado/tratado que vale registrar (ex.: falha de API, crash capturado). */
export function trackErro(e: unknown, contexto?: Props) {
  try {
    if (analyticsOk) posthog.captureException(e, contexto);
  } catch {
    /* analytics nunca derruba o app */
  }
}

export function resetAnalytics() {
  try {
    if (analyticsOk) posthog.reset();
  } catch {
    /* analytics nunca derruba o app */
  }
}
