import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";

/** Ícone por grupo de mercado — usado nos cards de especiais em destaque.
 *  Mercados do mesmo "tipo" (ex.: marca gol vs marca 2+) se distinguem pelo selo
 *  no canto do ícone: 2+, 1º, Ú, C (casa), F (fora). */
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

  const selo = g.includes("2+")
    ? "2+"
    : g.startsWith("PRIMEIRO")
      ? "1º"
      : g.startsWith("ÚLTIMO")
        ? "Ú"
        : /\bCASA\b/.test(g)
          ? "C"
          : /\bFORA\b/.test(g)
            ? "F"
            : null;

  const icone = g.includes("EXATO") ? (
    <PlacarSvg size={size} color={color} />
  ) : (
    <Ionicons name={nomeDo(g)} size={size} color={color} />
  );

  if (!selo) return icone;
  return (
    <View style={{ alignSelf: "flex-start" }}>
      {icone}
      <View
        style={{
          position: "absolute",
          right: -6,
          bottom: -4,
          minWidth: 14,
          paddingHorizontal: 2,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: color,
          backgroundColor: "rgba(18,18,18,0.95)",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color,
            fontSize: 8,
            fontFamily: "Montserrat_800ExtraBold",
            lineHeight: 10,
          }}
        >
          {selo}
        </Text>
      </View>
    </View>
  );
}

function nomeDo(g: string): keyof typeof Ionicons.glyphMap {
  if (g.includes("IMPEDID")) return "flag";
  if (g.startsWith("CART") || g.includes("CARTÃO")) return "hand-left-outline";
  if (g.startsWith("ESCANTEIO")) return "flag-outline";
  if (g.includes("ASSIST")) return "arrow-redo-outline";
  if (g.includes("GOLEIRO") || g.includes("DEFESA"))
    return "shield-checkmark-outline";
  if (g.includes("CHUTE")) return "locate-outline";
  if (g.includes("FALTA")) return "alert-circle-outline";
  if (g.includes("TEMPO") || g.startsWith("INTERVALO")) return "time-outline";
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
