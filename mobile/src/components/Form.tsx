import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Ficha } from "./Ficha";
import { useTheme } from "../store/Theme";
import { T } from "./ui";

export function Field({
  label,
  icon,
  iconNode,
  labelExtra,
  ...props
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconNode?: ReactNode;
  labelExtra?: ReactNode;
} & ComponentProps<typeof TextInput>) {
  const { palette: C } = useTheme();
  return (
    <View className="mb-4">
      <View className="mb-1.5 flex-row items-center">
        <T className="font-mont-b text-xs uppercase tracking-widest text-muted">
          {label}
        </T>
        {labelExtra}
      </View>
      <View className="flex-row items-center rounded-xl border border-line bg-card px-3">
        {iconNode ? (
          <View style={{ flexShrink: 0, marginRight: 2 }}>{iconNode}</View>
        ) : icon ? (
          <Ionicons name={icon} size={18} color={C.muted} />
        ) : null}
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
  ficha,
  editavel,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max: number;
  ficha?: boolean;
  editavel?: boolean;
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
      <View
        className={`mx-1 ${editavel ? "w-20" : "w-16"} flex-row items-center justify-center ${ficha ? "rounded-md border border-line bg-card px-1 py-0.5" : ""}`}
      >
        {editavel ? (
          <TextInput
            value={value ? String(value) : ""}
            placeholder="0"
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={5}
            selectTextOnFocus
            onChangeText={(t) => {
              const d = t.replace(/\D/g, "");
              onChange(Math.min(d ? parseInt(d, 10) : 0, value + max));
            }}
            className={`${ficha ? "w-11 py-0.5" : "w-12 rounded-md border border-line bg-card py-1"} text-center font-odds text-base text-fg`}
          />
        ) : (
          <T className="font-odds text-base">{value}</T>
        )}
        {ficha ? (
          <View className="ml-1">
            <Ficha size={16} />
          </View>
        ) : null}
      </View>
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
