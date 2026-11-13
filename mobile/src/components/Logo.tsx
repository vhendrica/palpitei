import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { useTheme } from "../store/Theme";
import { T } from "./ui";

const P_PATH =
  "M275 527 H565 C678 527 768 619 768 732 C768 845 678 937 565 937 H447 V817 H565 C608 817 643 779 643 732 C643 685 608 647 565 647 H402 V1111 H275 Z";
const CHECK_PATH = "M807 851 L896 771 L987 899 L1460 465 L987 1103 Z";

/** Marca PALPIT: "P" com o sinal de certo. Claro: selo branco; escuro: verde sobre preto. */
export function LogoMark({ size = 32 }: { size?: number }) {
  const { palette, noturno } = useTheme();
  if (noturno) {
    return (
      <Svg width={size * 1.4} height={size * 0.8} viewBox="255 445 1225 680">
        <Path d={P_PATH} fill={palette.logoP} />
        <Path d={CHECK_PATH} fill={palette.logoCheck} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 1600 1600">
      <Rect width={1600} height={1600} rx={360} fill={palette.logoBadge} />
      <Path d={P_PATH} fill={palette.logoP} transform="translate(-75 -10)" />
      <Path d={CHECK_PATH} fill={palette.logoCheck} transform="translate(-75 -10)" />
    </Svg>
  );
}

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <View className="flex-row items-center">
      <LogoMark size={lg ? 44 : 30} />
      <T
        className={`ml-2 font-mont-xb tracking-widest text-logoText ${lg ? "text-3xl" : "text-xl"}`}
      >
        PALPIT
      </T>
    </View>
  );
}
