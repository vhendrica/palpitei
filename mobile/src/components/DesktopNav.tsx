import { usePathname, useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { fmtPts } from "../lib/format";
import { useApp } from "../store/AppStore";
import { useTheme } from "../store/Theme";
import { T } from "./ui";

const TABS = [
  { rota: "/(tabs)", titulo: "Palpite", ativo: (p: string) => p === "/" },
  { rota: "/(tabs)/desafio", titulo: "Desafio", ativo: (p: string) => p.startsWith("/desafio") },
  { rota: "/(tabs)/ranking", titulo: "Ranking", ativo: (p: string) => p.startsWith("/ranking") },
  { rota: "/(tabs)/perfil", titulo: "Perfil", ativo: (p: string) => p.startsWith("/perfil") },
];

/** Barra de navegação no topo — só no desktop (web larga); mobile fica com a tab bar de baixo. */
export function DesktopNav() {
  const { palette: C } = useTheme();
  const { user } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const tabs = user?.is_admin ? [...TABS, { rota: "/(tabs)/admin", titulo: "Admin", ativo: (p: string) => p.startsWith("/admin") }] : TABS;

  return (
    <View
      className="flex-row items-center border-b border-line bg-card px-6"
      style={{ height: 52 }}
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
          <T className="font-odds text-sm text-primary">{fmtPts(user.saldo_pontos)} P</T>
          <View className="h-7 w-7 items-center justify-center rounded-full bg-primary">
            <T className="font-mont-xb text-xs text-onPrimary">
              {user.nome[0]?.toUpperCase()}
            </T>
          </View>
        </View>
      ) : null}
    </View>
  );
}
