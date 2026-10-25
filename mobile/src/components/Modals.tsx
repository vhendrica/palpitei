import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";

import { fmtPts } from "../lib/format";
import type { Voucher } from "../types";
import { Button, T } from "./ui";
import { ThemeVars, useTheme } from "../store/Theme";

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <ThemeVars>
        <Pressable
          className="flex-1 items-center justify-center bg-black/75 px-6"
          onPress={onClose}
        >
          <Pressable
            className="w-full max-w-md rounded-3xl border border-line bg-card p-6"
            onPress={() => {}}
          >
            {children}
          </Pressable>
        </Pressable>
      </ThemeVars>
    </Modal>
  );
}

type ConfirmProps = {
  visible: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  error,
  onConfirm,
  onClose,
}: ConfirmProps) {
  const { palette: C } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <T className="font-mont-xb text-xl">{title}</T>
      <View className="mt-3">
        {typeof message === "string" ? (
          <T className="text-sm leading-5 text-fg/80">{message}</T>
        ) : (
          message
        )}
      </View>
      {error ? (
        <View className="mt-4 flex-row items-center rounded-lg bg-danger/15 p-3">
          <Ionicons name="alert-circle" size={18} color={C.danger} />
          <T className="ml-2 flex-1 font-mont-sb text-sm text-danger">
            {error}
          </T>
        </View>
      ) : null}
      <Button title={confirmLabel} onPress={onConfirm} className="mt-6" />
      <Button
        title="Cancelar"
        variant="ghost"
        onPress={onClose}
        className="mt-2"
      />
    </Sheet>
  );
}

export function VoucherCard({
  voucher,
  nomeJogo,
}: {
  voucher: Voucher;
  nomeJogo?: string;
}) {
  const { palette: C } = useTheme();
  return (
    <View className="overflow-hidden rounded-2xl border-2 border-dashed border-primary bg-primary/10 p-4">
      <View className="flex-row items-center">
        <Ionicons name="trophy" size={20} color={C.gold} />
        <T className="ml-2 font-mont-xb text-xs uppercase tracking-widest text-gold">
          Voucher de campeão
        </T>
      </View>
      {nomeJogo ? (
        <T className="mt-2 font-mont-b text-sm text-muted">{nomeJogo}</T>
      ) : null}
      <T className="mt-1 font-mont-b text-base">{voucher.premio_desc}</T>
      <View className="mt-3 flex-row items-end justify-between">
        <View>
          <T className="text-[10px] uppercase tracking-widest text-muted">
            Código
          </T>
          <T className="font-odds text-2xl tracking-[4px] text-primary">
            {voucher.codigo}
          </T>
        </View>
        <T className="font-mont-b text-xs text-primary">
          +{fmtPts(voucher.pontos_devolvidos)} PONTOS
        </T>
      </View>
    </View>
  );
}

export function VoucherModal({
  voucher,
  nomeJogo,
  onClose,
}: {
  voucher: Voucher | null;
  nomeJogo?: string;
  onClose: () => void;
}) {
  const { palette: C } = useTheme();
  return (
    <Sheet visible={!!voucher} onClose={onClose}>
      <View className="items-center">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-gold/15">
          <Ionicons name="trophy" size={34} color={C.gold} />
        </View>
        <T className="mt-3 text-center font-mont-xb text-2xl">
          VOCÊ É O CAMPEÃO!
        </T>
        <T className="mt-1 text-center text-sm text-fg/70">
          Seus {voucher ? fmtPts(voucher.pontos_devolvidos) : ""} PONTOS da
          entrada voltaram para o saldo.
        </T>
      </View>
      {voucher ? (
        <View className="mt-5">
          <VoucherCard voucher={voucher} nomeJogo={nomeJogo} />
        </View>
      ) : null}
      <T className="mt-3 text-center text-xs text-muted">
        Apresente o código no estabelecimento parceiro.
      </T>
      <Button title="Show!" onPress={onClose} className="mt-5" />
    </Sheet>
  );
}
