import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fmtPts } from "../lib/format";
import { useApp } from "../store/AppStore";
import { useTheme } from "../store/Theme";
import { Logo } from "./Logo";
import { T } from "./ui";

export function PontosPill() {
  const { user } = useApp();
  const { palette: C } = useTheme();
  return (
    <Pressable
      onPress={() => router.push("/perfil")}
      className="flex-row items-center rounded-full border border-headerAccent/40 bg-onHeader/10 px-3 py-1.5"
    >
      <Ionicons name="wallet" size={14} color={C.headerAccent} />
      <T className="ml-1.5 font-odds text-sm text-headerAccent">
        {fmtPts(user?.saldo_pontos ?? 0)}
      </T>
      <T className="ml-1 font-mont-b text-[10px] text-onHeader/70">PONTOS</T>
    </Pressable>
  );
}

export function AppHeader({ title, back }: { title?: string; back?: boolean }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { palette: C } = useTheme();
  return (
    <View
      style={{ paddingTop: insets.top + 8 }}
      className="border-b border-black/10 bg-header px-4 pb-3"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center">
          {back ? (
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
              className="mr-3 p-1"
            >
              <Ionicons name="chevron-back" size={24} color={C.onHeader} />
            </Pressable>
          ) : null}
          {title ? (
            <T
              className="flex-1 font-mont-xb text-lg text-onHeader"
              numberOfLines={1}
            >
              {title}
            </T>
          ) : (
            <Logo />
          )}
        </View>
        <View className="flex-row items-center">
          {user?.is_premium ? (
            <View className="mr-2 rounded-full bg-headerAccent/20 px-2 py-1">
              <T className="font-mont-b text-[10px] text-headerAccent">
                PREMIUM
              </T>
            </View>
          ) : null}
          <PontosPill />
        </View>
      </View>
    </View>
  );
}
