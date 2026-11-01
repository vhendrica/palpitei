import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Switch, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { fmtReais } from "../../components/PremioBar";
import {
  Button,
  Card,
  EmptyState,
  SectionTitle,
  StatusBadge,
  T,
} from "../../components/ui";
import { api } from "../../lib/api";
import { fmtPts, fmtWhats } from "../../lib/format";
import { useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import type { Perfil as PerfilT } from "../../types";

const fmtDia = (d: string) => d.split("-").reverse().join("/");

export default function Perfil() {
  const { palette: C, noturno, setNoturno } = useTheme();
  const { user, sair, refreshUser } = useApp();
  const [perfil, setPerfil] = useState<PerfilT | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      refreshUser();
      api
        .me()
        .then(setPerfil)
        .catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]),
  );

  const tema = (
    <Card className="mt-3 flex-row items-center justify-between">
      <View className="flex-row items-center">
        <Ionicons name="moon" size={18} color={C.fg} />
        <T className="ml-2 font-mont-b text-sm">Modo noturno</T>
      </View>
      <Switch value={noturno} onValueChange={setNoturno} />
    </Card>
  );

  if (!user) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Perfil" />
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <EmptyState
            icon="person-circle-outline"
            title="Entre pra ver seu saldo"
            subtitle="Crie sua conta e ganhe PONTOS de boas-vindas."
          />
          <Button
            title="Entrar ou criar conta"
            onPress={() => router.push("/entrar")}
            className="mt-3"
          />
          {tema}
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Perfil" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="flex-row items-center">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-primary">
            <T className="font-mont-xb text-2xl text-onPrimary">
              {user.nome[0]?.toUpperCase()}
            </T>
          </View>
          <View className="ml-3 flex-1">
            <T className="font-mont-xb text-lg">{user.nome}</T>
            <T className="text-xs text-muted">{fmtWhats(user.whatsapp)}</T>
            <View className="mt-1 flex-row items-center">
              <Ionicons name="location" size={12} color={C.primary} />
              <T className="ml-1 font-mont-sb text-xs text-primary">
                {user.bairro}
              </T>
            </View>
          </View>
        </Card>

        <View className="mt-3 rounded-2xl border border-primary/40 bg-primary/10 p-5">
          <T className="text-[10px] uppercase tracking-widest text-primary">
            Saldo do perfil
          </T>
          <View className="flex-row items-end">
            <T className="font-odds text-5xl text-primary">
              {fmtPts(user.saldo_pontos)}
            </T>
            <T className="mb-2 ml-2 font-mont-b text-sm text-primary">PONTOS</T>
          </View>
        </View>

        <SectionTitle>Vouchers</SectionTitle>
        {perfil?.vouchers.length ? (
          perfil.vouchers.map((v) => (
            <Card key={v.codigo} className="mb-2 flex-row items-center">
              <Ionicons name="ticket" size={22} color={C.gold} />
              <View className="ml-3 flex-1">
                <T className="font-mont-xb text-base">{v.codigo}</T>
                <T className="text-xs text-muted">
                  Palpite de {fmtDia(v.data)}
                </T>
              </View>
              <T className="font-odds text-lg text-gold">{fmtReais(v.valor)}</T>
            </Card>
          ))
        ) : (
          <T className="text-sm text-muted">Nenhum voucher ainda.</T>
        )}

        <SectionTitle>Meus palpites</SectionTitle>
        {perfil?.historico.length ? (
          perfil.historico.map((h) => (
            <Card
              key={h.liga_id}
              className="mb-2 flex-row items-center justify-between"
            >
              <View>
                <T className="font-mont-b text-sm">
                  Rodada de {fmtDia(h.data)}
                </T>
                <T className="text-xs text-muted">{h.fichas_total} fichas</T>
              </View>
              <StatusBadge status={h.status} />
            </Card>
          ))
        ) : (
          <T className="text-sm text-muted">Você ainda não palpitou.</T>
        )}

        {tema}
        <Button title="Sair" variant="danger" onPress={sair} className="mt-6" />
      </ScrollView>
    </View>
  );
}
