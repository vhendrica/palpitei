import PostHog from "posthog-react-native";

/**
 * Analytics (PostHog): localização via GeoIP + fluxo de telas/eventos.
 * Sem `EXPO_PUBLIC_POSTHOG_KEY` no .env tudo vira no-op — o app funciona igual.
 * Nunca envie nome, whatsapp ou CPF: o identify usa só o id interno + bairro.
 */

// Mesma chave pública do projeto PostHog (só escreve eventos). EXPO_PUBLIC_POSTHOG_KEY sobrescreve.
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "phc_B3X7ieUMyTBBTe2Vxa7Pq6fNTFvPomhzmK2srddZV6dw";
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export const analyticsOk = KEY.startsWith("phc_");

export const posthog = analyticsOk
  ? new PostHog(KEY, {
      host: HOST,
      // "file" usa async-storage/expo-file-system: fila sobrevive a app fechado/offline.
      persistence: "file",
      captureAppLifecycleEvents: true,
      // Erros JS não tratados viram $exception no error tracking do PostHog.
      errorTracking: { autocapture: true },
    })
  : null;

type Props = Record<string, string | number | boolean | null>;

// Segmentos que são nome de rota — o resto vira ":id" pra agregar telas iguais
// (ex.: /desafio/abc123 → /desafio/:id) no relatório de fluxo do PostHog.
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
    posthog?.capture(evento, props);
  } catch {
    /* analytics nunca derruba o app */
  }
}

export function trackScreen(pathname: string) {
  try {
    posthog?.screen(nomeTela(pathname));
  } catch {
    /* analytics nunca derruba o app */
  }
}

export function identifyUser(u: { id: string; bairro?: string | null } | null) {
  try {
    if (u) posthog?.identify(u.id, { $set: { bairro: u.bairro ?? null } });
  } catch {
    /* analytics nunca derruba o app */
  }
}

/** Erro esperado/tratado que vale registrar (ex.: falha de API, crash capturado). */
export function trackErro(e: unknown, contexto?: Props) {
  try {
    posthog?.captureException(e, contexto);
  } catch {
    /* analytics nunca derruba o app */
  }
}

export function resetAnalytics() {
  try {
    posthog?.reset();
  } catch {
    /* analytics nunca derruba o app */
  }
}
