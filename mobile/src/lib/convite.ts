import * as Linking from "expo-linking";
import { Platform, Share } from "react-native";

/** Link do convite. Web: o app roda em <domínio>/app/... — o link precisa do prefixo. Nativo: scheme palpitei://. */
export function linkConvite(token: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const base = window.location.pathname.split(/\/(desafio|historico|palpiteiros|perfil|ranking)(\/|$)/)[0].replace(/\/$/, "");
    return `${window.location.origin}${base}/desafio/convite?token=${token}`;
  }
  return `palpitei://desafio/convite?token=${token}`;
}

/** Copia pro clipboard (só web). Devolve se copiou. */
export async function copiar(texto: string) {
  if (Platform.OS !== "web" || typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export const podeCopiar = Platform.OS === "web";

/** Compartilha; onde não há compartilhamento nativo (ex.: Firefox desktop) copia. Devolve "copiado" nesse caso. */
export async function compartilhar(mensagem: string): Promise<"ok" | "copiado" | "falhou"> {
  if (Platform.OS === "web" && (typeof navigator === "undefined" || !navigator.share)) {
    return (await copiar(mensagem)) ? "copiado" : "falhou";
  }
  try {
    await Share.share({ message: mensagem });
    return "ok";
  } catch {
    return "falhou";
  }
}

export function enviarWhatsApp(mensagem: string) {
  if (Platform.OS === "web") return Linking.openURL(`https://wa.me/?text=${encodeURIComponent(mensagem)}`);
  return Share.share({ message: mensagem });
}
