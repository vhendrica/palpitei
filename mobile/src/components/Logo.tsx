import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { useTheme } from "../store/Theme";
import { T } from "./ui";

const P_PATH =
  "M24 16 H55 C68 16 78 26 78 38 C78 50 68 60 55 60 H41 V84 H24 Z M41 30 V46 H54 C58.5 46 62 42.5 62 38 C62 33.5 58.5 30 54 30 Z";
const CHECK_PATH = "M48 66 L60 78 L86 50";

/** Marca Palpitei: "P" com um sinal de certo verde. */
export function LogoMark({ size = 32 }: { size?: number }) {
  const { palette } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={24}
        fill={palette.logoBadge}
      />
      <Path
        d={P_PATH}
        fill={palette.fg}
        fillRule="evenodd"
        transform="translate(6 4) scale(0.88)"
      />
      <Path
        d={CHECK_PATH}
        transform="translate(6 4) scale(0.88)"
        fill="none"
        stroke={palette.logoBadge}
        strokeWidth={20}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={CHECK_PATH}
        transform="translate(6 4) scale(0.88)"
        fill="none"
        stroke={palette.check}
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <View className="flex-row items-center">
      <LogoMark size={lg ? 44 : 30} />
      <T
        className={`ml-2 font-mont-xb text-onHeader ${lg ? "text-3xl" : "text-xl"}`}
      >
        Palpitei
      </T>
    </View>
  );
}
