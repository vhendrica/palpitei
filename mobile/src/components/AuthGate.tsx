import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { useTheme } from "../store/Theme";
import { Button, Card, T } from "./ui";

/**
 * Estado padrão "precisa estar logado": mesmo visual em todas as telas
 * (Desafio, Simulador, Histórico, Perfil). Antes, cada tela improvisava o seu.
 */
export function AuthGate({
  icon = "person-circle-outline",
  title,
  subtitle,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const { palette: C } = useTheme();
  return (
    <Card className="items-center py-8">
      <Ionicons name={icon} size={36} color={C.muted} />
      <T className="mt-3 text-center font-mont-b text-base">{title}</T>
      {subtitle ? (
        <T className="mt-1 text-center text-sm text-muted">{subtitle}</T>
      ) : null}
      <Button
        title="Entrar ou criar conta"
        onPress={() => router.push("/entrar")}
        className="mt-4 self-stretch"
      />
    </Card>
  );
}
