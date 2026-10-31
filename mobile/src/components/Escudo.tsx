import { useState } from "react";
import { Image, View } from "react-native";

import { escudo } from "../lib/escudos";
import { T } from "./ui";

export function Escudo({ time, size = 40 }: { time: string; size?: number }) {
  const [erro, setErro] = useState(false);
  const src = escudo(time);
  if (src && !erro)
    return (
      <Image
        source={src}
        style={{ width: size, height: size }}
        resizeMode="contain"
        onError={() => setErro(true)}
      />
    );
  return (
    <View
      className="items-center justify-center rounded-full bg-cardAlt"
      style={{ width: size, height: size }}
    >
      <T className="font-mont-xb" style={{ fontSize: size * 0.42 }}>
        {time.trim().charAt(0).toUpperCase()}
      </T>
    </View>
  );
}
