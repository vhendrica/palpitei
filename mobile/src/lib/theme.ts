import { vars } from 'nativewind';

export type Scheme = 'light' | 'dark';

export type Palette = {
  bg: string;
  card: string;
  cardAlt: string;
  line: string;
  fg: string;
  muted: string;
  primary: string;
  onPrimary: string;
  header: string;
  onHeader: string;
  headerAccent: string;
  danger: string;
  gold: string;
  check: string;
  logoBadge: string;
};

/** light = padrão (estilo bet365, claro). dark = modo noturno (#121212 / #1E1E1E / #00FF88). */
export const PALETTES: Record<Scheme, Palette> = {
  light: {
    bg: '#EEF0F2',
    card: '#FFFFFF',
    cardAlt: '#F3F4F6',
    line: '#DCDFE3',
    fg: '#1A1A1A',
    muted: '#6B7280',
    primary: '#14805E',
    onPrimary: '#FFFFFF',
    header: '#126E51',
    onHeader: '#FFFFFF',
    headerAccent: '#FFDF1B',
    danger: '#D93445',
    gold: '#B7791F',
    check: '#00C46A',
    logoBadge: '#FFFFFF',
  },
  dark: {
    bg: '#121212',
    card: '#1E1E1E',
    cardAlt: '#262626',
    line: '#2E2E2E',
    fg: '#FFFFFF',
    muted: '#9A9A9A',
    primary: '#00FF88',
    onPrimary: '#121212',
    header: '#121212',
    onHeader: '#FFFFFF',
    headerAccent: '#00FF88',
    danger: '#FF4D5E',
    gold: '#FFC83D',
    check: '#00FF88',
    logoBadge: '#1E1E1E',
  },
};

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** CSS variables consumidas pelo tailwind.config.js (ex: --c-card-alt: "243 244 246"). */
export function cssVars(p: Palette): Record<string, string> {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [`--c-${kebab(k)}`, rgb(v)]));
}

export const THEME_VARS = {
  light: vars(cssVars(PALETTES.light)),
  dark: vars(cssVars(PALETTES.dark)),
};
