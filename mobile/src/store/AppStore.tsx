import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, ApiError, setToken, type CadastroInput } from "../lib/api";
import type { CodigoEnviado, Home, User } from "../types";

const TOKEN_KEY = "palpit:token:v1";

type AppStore = {
  ready: boolean;
  user: User | null;
  home: Home | null;
  homeErro: string | null;
  refreshHome: () => Promise<void>;
  refreshUser: () => Promise<void>;
  cadastrar: (input: CadastroInput) => Promise<CodigoEnviado>;
  pedirCodigo: (whatsapp: string) => Promise<CodigoEnviado>;
  reenviarCodigo: (whatsapp: string) => Promise<CodigoEnviado>;
  confirmarCodigo: (
    whatsapp: string,
    codigo: string,
  ) => Promise<{ nova_conta: boolean }>;
  sair: () => Promise<void>;
  entrarNaLiga: () => Promise<void>;
  apostar: (distribuicao: Record<string, number>) => Promise<number>;
};

const Ctx = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [homeErro, setHomeErro] = useState<string | null>(null);

  const limparSessao = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      setUser((await api.me()).user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await limparSessao();
    }
  }, [limparSessao]);

  const refreshHome = useCallback(async () => {
    try {
      const h = await api.home();
      setHome(h);
      setHomeErro(null);
      setUser((u) =>
        u && h.usuario ? { ...u, saldo_pontos: h.usuario.saldo_pontos } : u,
      );
    } catch (e) {
      setHomeErro(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem(TOKEN_KEY);
        if (t) {
          setToken(t);
          await refreshUser();
        }
        await refreshHome();
      } finally {
        setReady(true);
      }
    })();
  }, [refreshHome, refreshUser]);

  const store = useMemo<AppStore>(
    () => ({
      ready,
      user,
      home,
      homeErro,
      refreshHome,
      refreshUser,
      cadastrar: (input) => api.cadastro(input),
      pedirCodigo: (whatsapp) => api.login(whatsapp),
      reenviarCodigo: (whatsapp) => api.reenviar(whatsapp),
      confirmarCodigo: async (whatsapp, codigo) => {
        const r = await api.confirmar(whatsapp, codigo);
        setToken(r.token);
        await AsyncStorage.setItem(TOKEN_KEY, r.token).catch(() => {});
        setUser(r.user);
        await refreshHome();
        return { nova_conta: r.nova_conta };
      },
      sair: async () => {
        await api.logout().catch(() => {});
        await limparSessao();
        await refreshHome();
      },
      entrarNaLiga: async () => {
        await api.entrar();
        await refreshHome();
      },
      apostar: async (distribuicao) => {
        const r = await api.apostar(distribuicao);
        await refreshHome();
        return r.fichas_distribuidas;
      },
    }),
    [ready, user, home, homeErro, refreshHome, refreshUser, limparSessao],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp deve ser usado dentro de AppStoreProvider");
  return ctx;
}

export function errorMessage(e: unknown) {
  return e instanceof ApiError
    ? e.message
    : "Algo deu errado. Tente novamente.";
}
