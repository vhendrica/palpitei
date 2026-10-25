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
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";

import { DemoBridge } from "../components/DemoBridge";
import { AppStoreProvider, useApp } from "../store/AppStore";
import { ThemeStoreProvider, useTheme } from "../store/Theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { ready, user } = useApp();
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
      <DemoBridge />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
        }}
      >
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="liga/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
      </Stack>
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
