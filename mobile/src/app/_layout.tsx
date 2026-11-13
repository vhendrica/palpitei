import "../../global.css";

import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/montserrat";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { Stack } from "expo-router/stack";
import { ActivityIndicator, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";

import { DesktopNav } from "../components/DesktopNav";
import { useDesktop } from "../lib/desktop";
import { AppStoreProvider, useApp } from "../store/AppStore";
import { ThemeStoreProvider, useTheme } from "../store/Theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { ready, carregando, toast } = useApp();
  const desktop = useDesktop();
  const { ready: themeReady, scheme, palette } = useTheme();
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });
  const loaded = ready && themeReady && fontsLoaded;

  const navTheme = useMemo(() => {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: palette.bg,
        card: palette.card,
        text: palette.fg,
        primary: palette.primary,
        border: palette.line,
      },
    };
  }, [scheme, palette]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        {desktop ? <DesktopNav /> : null}
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="entrar" />
            <Stack.Screen name="cadastro" />
            <Stack.Screen name="codigo" />
            <Stack.Screen name="palpiteiros" />
          </Stack>
        </View>
      </View>
      {carregando ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          pointerEvents="auto"
        >
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : null}
      {toast ? (
        <View
          style={{
            position: "absolute",
            bottom: 40,
            left: 16,
            right: 16,
            backgroundColor: toast.tipo === "erro" ? "#B42318" : "#14805E",
            borderRadius: 10,
            padding: 14,
            zIndex: 9999,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", textAlign: "center" }}>{toast.texto}</Text>
        </View>
      ) : null}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeStoreProvider>
      <AppStoreProvider>
        <RootNavigator />
      </AppStoreProvider>
    </ThemeStoreProvider>
  );
}
