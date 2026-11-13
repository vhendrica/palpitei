import { usePathname, useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { fmtPts } from "../lib/format";
import { useApp } from "../store/AppStore";
import { useTheme } from "../store/Theme";
import { T } from "./ui";

const TABS = [
  { rota: "/(tabs)", titulo: "Palpite", ativo: (p: string) => p === "/" },
  { rota: "/(tabs)/desafio", titulo: "Desafio", ativo: (p: string) => p.startsWith("/desafio") },
  { rota: "/(tabs)/ranking", titulo: "Ranking", ativo: (p: string) => p.startsWith("/ranking") || p.startsWith("/palpiteiros") },
  { rota: "/(tabs)/perfil", titulo: "Perfil", ativo: (p: string) => p.startsWith("/perfil") || p.startsWith("/historico") },
];

/** Barra de navegação no topo — só no desktop (web larga), em todas as telas; mobile fica com a tab bar de baixo. */
export function DesktopNav() {
  const { palette: C } = useTheme();
  const { user, home } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const tabs = user?.is_admin ? [...TABS, { rota: "/(tabs)/admin", titulo: "Admin", ativo: (p: string) => p.startsWith("/admin") }] : TABS;
  const streak = home?.usuario?.login_streak ?? user?.login_streak ?? 0;

  return (
    <View className="border-b border-line bg-card">
      <View
        className="flex-row items-center px-4"
        style={{ height: 52, maxWidth: 1212, width: "100%", alignSelf: "center" }}
      >
        <Pressable onPress={() => router.push("/(tabs)")}>
          <T className="font-mont-xb text-base">
            PAL<T className="text-primary">PIT</T>
          </T>
        </Pressable>
        <View className="ml-8 flex-row items-center" style={{ height: "100%" }}>
          {tabs.map((t) => {
            const on = t.ativo(pathname);
            return (
              <Pressable
                key={t.rota}
                onPress={() => router.push(t.rota as never)}
                className="hover:bg-cardAlt"
                style={{
                  height: "100%",
                  justifyContent: "center",
                  paddingHorizontal: 14,
                  borderBottomWidth: 2,
                  borderBottomColor: on ? C.primary : "transparent",
                }}
              >
                <T className={`text-xs font-mont-b ${on ? "" : "text-muted"}`}>{t.titulo}</T>
              </Pressable>
            );
          })}
        </View>
        {user ? (
          <View className="ml-auto flex-row items-center" style={{ gap: 14 }}>
            {streak > 0 ? (
              <T className="text-xs text-muted">
                sequência{" "}
                <T className="font-odds text-xs">
                  {streak} {streak === 1 ? "dia" : "dias"}
                </T>
              </T>
            ) : null}
            <T className="font-odds text-sm text-primary">{fmtPts(user.saldo_pontos)} PONTOS</T>
            <Pressable
              onPress={() => router.push("/(tabs)/perfil")}
              className="h-7 w-7 items-center justify-center rounded-full bg-primary"
            >
              <T className="font-mont-xb text-xs text-onPrimary">{user.nome[0]?.toUpperCase()}</T>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => router.push("/entrar")} className="ml-auto rounded-full bg-primary px-4 py-1.5">
            <T className="font-mont-xb text-xs text-onPrimary">ENTRAR</T>
          </Pressable>
        )}
      </View>
    </View>
  );
}
