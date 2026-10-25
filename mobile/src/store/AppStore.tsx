import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createMockDB } from "../data/mock";
import { BONUS_LOGIN_PREMIUM } from "../lib/constants";
import * as rules from "../lib/rules";
import type { Anuncio, DB, User, Voucher } from "../types";

const DB_KEY = "palpitei:db:v4";
const USER_KEY = "palpitei:currentUserId:v4";

/** Estado da sessão (abertura do app): não é persistido. */
type Session = {
  banner: Anuncio | null;
  interstitial: Anuncio | null;
  interstitialVisto: boolean;
  /** PONTOS do bônus de login diário (Premium) aguardando crédito. */
  bonusLogin: number;
};

type AppStore = {
  ready: boolean;
  db: DB;
  user: User | null;
  session: Session;
  voucherRecente: Voucher | null;
  onboard: (input: { name: string; whatsapp: string; bairro: string }) => void;
  entrarNaLiga: (ligaId: string) => void;
  apostar: (ligaId: string, distribuicao: Record<string, number>) => void;
  finalizarLiga: (
    ligaId: string,
    mercadosVencedores: string[],
  ) => Voucher | null;
  setPremium: (value: boolean) => void;
  fecharInterstitial: () => void;
  reabrirApp: () => void;
  receberBonusLogin: () => void;
  fecharVoucher: () => void;
  resetDemo: () => Promise<void>;
};

const Ctx = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<DB>(createMockDB);
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<Session>({
    banner: null,
    interstitial: null,
    interstitialVisto: false,
    bonusLogin: 0,
  });
  const [voucherRecente, setVoucherRecente] = useState<Voucher | null>(null);
  const sorteado = useRef(false);
  const dbRef = useRef(db);

  useEffect(() => {
    (async () => {
      try {
        const [rawDb, rawUser] = await Promise.all([
          AsyncStorage.getItem(DB_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (rawDb) {
          dbRef.current = JSON.parse(rawDb);
          setDb(dbRef.current);
        }
        if (rawUser) setUserId(rawUser);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const commit = useCallback((next: DB) => {
    dbRef.current = next;
    setDb(next);
    AsyncStorage.setItem(DB_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const user = useMemo(
    () => db.users.find((u) => u.id === userId) ?? null,
    [db.users, userId],
  );

  // Sorteio de 1 banner + 1 interstitial por abertura de app (sessão).
  useEffect(() => {
    if (!ready || !user || sorteado.current) return;
    sorteado.current = true;
    setSession({
      banner: rules.sortear(rules.anunciosElegiveis(db, "banner", user)),
      interstitial: rules.sortear(
        rules.anunciosElegiveis(db, "interstitial", user),
      ),
      interstitialVisto: false,
      bonusLogin: 0,
    });
  }, [ready, user, db]);

  const requireUser = useCallback(() => {
    if (!userId) throw new rules.RuleError("Faça o cadastro primeiro.");
    return userId;
  }, [userId]);

  const store = useMemo<AppStore>(
    () => ({
      ready,
      db,
      user,
      session,
      voucherRecente,
      onboard: (input) => {
        const res = rules.criarUsuario(dbRef.current, input);
        commit(res.db);
        setUserId(res.user.id);
        AsyncStorage.setItem(USER_KEY, res.user.id).catch(() => {});
      },
      entrarNaLiga: (ligaId) =>
        commit(rules.entrarNaLiga(dbRef.current, requireUser(), ligaId)),
      apostar: (ligaId, distribuicao) =>
        commit(
          rules.apostar(dbRef.current, requireUser(), ligaId, distribuicao),
        ),
      finalizarLiga: (ligaId, vencedores) => {
        const res = rules.finalizarLiga(dbRef.current, ligaId, vencedores);
        commit(res.db);
        if (res.voucher && res.voucher.user_id === userId)
          setVoucherRecente(res.voucher);
        return res.voucher;
      },
      setPremium: (value) => {
        const id = requireUser();
        commit({
          ...dbRef.current,
          users: dbRef.current.users.map((u) =>
            u.id === id ? { ...u, is_premium: value } : u,
          ),
        });
      },
      fecharInterstitial: () =>
        setSession((s) => ({ ...s, interstitialVisto: true })),
      reabrirApp: () => {
        const d = dbRef.current;
        const u = d.users.find((x) => x.id === userId);
        if (!u) return;
        setSession({
          banner: rules.sortear(rules.anunciosElegiveis(d, "banner", u)),
          interstitial: rules.sortear(
            rules.anunciosElegiveis(d, "interstitial", u),
          ),
          interstitialVisto: false,
          bonusLogin: u.is_premium ? BONUS_LOGIN_PREMIUM : 0,
        });
      },
      receberBonusLogin: () => {
        setSession((s) => {
          if (s.bonusLogin > 0 && userId) {
            const valor = s.bonusLogin;
            commit({
              ...dbRef.current,
              users: dbRef.current.users.map((u) =>
                u.id === userId
                  ? { ...u, saldo_pontos: u.saldo_pontos + valor }
                  : u,
              ),
            });
          }
          return { ...s, bonusLogin: 0 };
        });
      },
      fecharVoucher: () => setVoucherRecente(null),
      resetDemo: async () => {
        await AsyncStorage.multiRemove([DB_KEY, USER_KEY]);
        sorteado.current = false;
        setSession({
          banner: null,
          interstitial: null,
          interstitialVisto: false,
          bonusLogin: 0,
        });
        setUserId(null);
        commit(createMockDB());
      },
    }),
    [ready, db, user, session, voucherRecente, commit, requireUser, userId],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp deve ser usado dentro de AppStoreProvider");
  return ctx;
}

export function errorMessage(e: unknown) {
  return e instanceof rules.RuleError
    ? e.message
    : "Algo deu errado. Tente novamente.";
}
