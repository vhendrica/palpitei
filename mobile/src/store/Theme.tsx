import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform, View } from "react-native";

import {
  cssVars,
  PALETTES,
  THEME_VARS,
  type Palette,
  type Scheme,
} from "../lib/theme";

const THEME_KEY = "palpitei:theme:v1";

type ThemeStore = {
  ready: boolean;
  scheme: Scheme;
  palette: Palette;
  noturno: boolean;
  setNoturno: (value: boolean) => void;
};

const Ctx = createContext<ThemeStore | null>(null);

export function ThemeStoreProvider({ children }: { children: ReactNode }) {
  const [scheme, setScheme] = useState<Scheme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((v) => {
        if (v === "dark" || v === "light") setScheme(v);
      })
      .finally(() => setReady(true));
  }, []);

  // No web, Modals são renderizados via portal fora da árvore: aplica as variáveis também no <html>.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const root = document.documentElement;
    for (const [k, v] of Object.entries(cssVars(PALETTES[scheme])))
      root.style.setProperty(k, v);
    root.style.colorScheme = scheme;
    root.style.backgroundColor = PALETTES[scheme].bg;
  }, [scheme]);

  const value = useMemo<ThemeStore>(
    () => ({
      ready,
      scheme,
      palette: PALETTES[scheme],
      noturno: scheme === "dark",
      setNoturno: (on) => {
        const next: Scheme = on ? "dark" : "light";
        setScheme(next);
        AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
      },
    }),
    [ready, scheme],
  );

  return (
    <Ctx.Provider value={value}>
      <ThemeVars>{children}</ThemeVars>
    </Ctx.Provider>
  );
}

/** Aplica as CSS variables do tema atual (usar também na raiz de Modals). */
export function ThemeVars({
  children,
  className = "flex-1",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { scheme } = useTheme();
  return (
    <View style={THEME_VARS[scheme]} className={className}>
      {children}
    </View>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useTheme deve ser usado dentro de ThemeStoreProvider");
  return ctx;
}
