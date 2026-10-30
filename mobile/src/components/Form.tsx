import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, TextInput, View } from "react-native";

import { useTheme } from "../store/Theme";
import { T } from "./ui";

export function Field({
  label,
  icon,
  ...props
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
} & ComponentProps<typeof TextInput>) {
  const { palette: C } = useTheme();
  return (
    <View className="mb-4">
      <T className="mb-1.5 font-mont-b text-xs uppercase tracking-widest text-muted">
        {label}
      </T>
      <View className="flex-row items-center rounded-xl border border-line bg-card px-3">
        {icon ? <Ionicons name={icon} size={18} color={C.muted} /> : null}
        <TextInput
          placeholderTextColor={C.muted}
          className="ml-2 flex-1 py-3.5 font-mont-sb text-base text-fg"
          {...props}
        />
      </View>
    </View>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const { palette: C } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="mb-3 flex-row items-center"
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-md border-2 ${checked ? "border-primary bg-primary" : "border-line bg-card"}`}
      >
        {checked ? (
          <Ionicons name="checkmark" size={16} color={C.onPrimary} />
        ) : null}
      </View>
      <T className="ml-3 flex-1 font-mont-sb text-sm">{label}</T>
    </Pressable>
  );
}

export function ErrorBox({ erro }: { erro: string | null }) {
  const { palette: C } = useTheme();
  if (!erro) return null;
  return (
    <View className="mt-4 flex-row items-center rounded-lg bg-danger/15 p-3">
      <Ionicons name="alert-circle" size={18} color={C.danger} />
      <T className="ml-2 flex-1 font-mont-sb text-sm text-danger">{erro}</T>
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  step = 10,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max: number;
}) {
  const { palette: C } = useTheme();
  return (
    <View className="flex-row items-center">
      <Pressable
        onPress={() => onChange(Math.max(0, value - step))}
        disabled={value <= 0}
        className={`h-8 w-8 items-center justify-center rounded-full bg-cardAlt ${value <= 0 ? "opacity-40" : ""}`}
      >
        <Ionicons name="remove" size={18} color={C.fg} />
      </Pressable>
      <T className="w-12 text-center font-odds text-base">{value}</T>
      <Pressable
        onPress={() => onChange(value + Math.min(step, max))}
        disabled={max <= 0}
        className={`h-8 w-8 items-center justify-center rounded-full bg-primary ${max <= 0 ? "opacity-40" : ""}`}
      >
        <Ionicons name="add" size={18} color={C.onPrimary} />
      </Pressable>
    </View>
  );
}
