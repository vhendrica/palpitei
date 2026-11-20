import { Ionicons } from "@expo/vector-icons";
import Svg, { Line, Rect } from "react-native-svg";

/** Ícone por grupo de mercado — usado nos cards de especiais em destaque. */
export function IconeMercado({
  grupo,
  size = 22,
  color,
}: {
  grupo?: string | null;
  size?: number;
  color: string;
}) {
  const g = (grupo ?? "").toUpperCase();

  if (g.includes("EXATO")) {
    return <PlacarSvg size={size} color={color} />;
  }

  const nome = ((): keyof typeof Ionicons.glyphMap => {
    if (g.includes("IMPEDID")) return "flag";
    if (g.startsWith("CART") || g.includes("CARTÃO")) return "hand-left-outline";
    if (g.startsWith("ESCANTEIO")) return "flag-outline";
    if (g.includes("ASSIST")) return "arrow-redo-outline";
    if (g.includes("GOLEIRO") || g.includes("DEFESA"))
      return "shield-checkmark-outline";
    if (g.includes("CHUTE")) return "locate-outline";
    if (g.includes("FALTA")) return "alert-circle-outline";
    if (g.includes("TEMPO") || g.startsWith("INTERVALO"))
      return "time-outline";
    if (g.startsWith("VIRA")) return "repeat-outline";
    if (g.startsWith("HANDICAP")) return "scale-outline";
    if (
      g.startsWith("GOLS") ||
      g.startsWith("AMBOS") ||
      g.startsWith("MARCA") ||
      g.includes("MARCAR")
    )
      return "football-outline";
    return "star-outline";
  })();

  return <Ionicons name={nome} size={size} color={color} />;
}

/** Placar de jogo no pedestal (sem números), desenhado no estilo outline do Ionicons. */
function PlacarSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Rect
        x={64}
        y={132}
        width={384}
        height={212}
        rx={26}
        stroke={color}
        strokeWidth={30}
      />
      <Line
        x1={256}
        y1={132}
        x2={256}
        y2={344}
        stroke={color}
        strokeWidth={24}
      />
      <Line
        x1={256}
        y1={344}
        x2={256}
        y2={436}
        stroke={color}
        strokeWidth={32}
        strokeLinecap="round"
      />
      <Line
        x1={168}
        y1={452}
        x2={344}
        y2={452}
        stroke={color}
        strokeWidth={32}
        strokeLinecap="round"
      />
    </Svg>
  );
}
