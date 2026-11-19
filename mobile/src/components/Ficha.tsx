import Svg, { Circle, G, Rect } from "react-native-svg";

import { useTheme } from "../store/Theme";

/** Ficha de pôquer nas cores da marca. */
export function Ficha({ size = 18 }: { size?: number }) {
  const { palette: C } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11.5} fill={C.primary} />
      <G fill="#FFFFFF">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <Rect
            key={a}
            x={10.2}
            y={0.5}
            width={3.6}
            height={4}
            rx={0.6}
            transform={`rotate(${a} 12 12)`}
          />
        ))}
      </G>
      <Circle
        cx={12}
        cy={12}
        r={7}
        fill={C.primary}
        stroke="#FFFFFF"
        strokeWidth={1.2}
        strokeDasharray="2.2 1.6"
      />
      <Circle cx={12} cy={12} r={3.6} fill="#FFFFFF" opacity={0.9} />
    </Svg>
  );
}
