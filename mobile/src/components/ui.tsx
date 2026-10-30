import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type TextProps,
} from "react-native";

import { STATUS_LABEL } from "../lib/format";
import type { LigaStatus } from "../types";
import { useTheme } from "../store/Theme";

const TEXT_COLOR =
  /(^|\s)text-(white|black|fg|muted|primary|onPrimary|danger|gold|onHeader|headerAccent|brand|bg)(\/|\s|$)/;

export function T({
  className = "",
  ...props
}: TextProps & { className?: string }) {
  const temCor = TEXT_COLOR.test(className);
  return (
    <Text
      {...props}
      className={`font-mont ${temCor ? "" : "text-fg"} ${className}`}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={`rounded-2xl border border-line bg-card p-4 ${className}`}>
      {children}
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  className = "",
}: ButtonProps) {
  const { palette: C } = useTheme();
  const base = "flex-row items-center justify-center rounded-xl px-4 py-3.5";
  const styles = {
    primary: "bg-primary",
    outline: "border border-primary bg-transparent",
    ghost: "bg-cardAlt",
    danger: "border border-danger bg-transparent",
  }[variant];
  const textColor = {
    primary: "text-onPrimary",
    outline: "text-primary",
    ghost: "text-fg",
    danger: "text-danger",
  }[variant];
  const iconColor = {
    primary: C.onPrimary,
    outline: C.primary,
    ghost: C.fg,
    danger: C.danger,
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`${base} ${styles} ${disabled ? "opacity-40" : "active:opacity-80"} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={iconColor}
              style={{ marginRight: 8 }}
            />
          ) : null}
          <T
            className={`font-mont-xb text-sm uppercase tracking-wide ${textColor}`}
          >
            {title}
          </T>
        </>
      )}
    </Pressable>
  );
}

export function StatusBadge({ status }: { status: LigaStatus }) {
  const styles = {
    aberta: "bg-primary/15 text-primary",
    em_andamento: "bg-danger/15 text-danger",
    finalizada: "bg-fg/10 text-muted",
  }[status];
  return (
    <View
      className={`flex-row items-center rounded-full px-2.5 py-1 ${styles.split(" ")[0]}`}
    >
      {status === "em_andamento" ? (
        <View className="mr-1.5 h-1.5 w-1.5 rounded-full bg-danger" />
      ) : null}
      <T
        className={`font-mont-b text-[10px] tracking-widest ${styles.split(" ")[1]}`}
      >
        {STATUS_LABEL[status]}
      </T>
    </View>
  );
}

export function SectionTitle({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View className="mb-3 mt-6 flex-row items-center justify-between">
      <View className="flex-row items-center">
        <View className="mr-2 h-4 w-1 rounded-full bg-primary" />
        <T className="font-mont-xb text-base uppercase tracking-wide">
          {children}
        </T>
      </View>
      {right}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
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
    </Card>
  );
}
