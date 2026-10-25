import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, ScrollView, Switch, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { VoucherCard } from "../../components/Modals";
import {
  Button,
  Card,
  SectionTitle,
  StatusBadge,
  T,
} from "../../components/ui";
import { fmtPts, fmtWhats } from "../../lib/format";
import { calcularRanking } from "../../lib/rules";
import { useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";

export default function Perfil() {
  const { palette: C, noturno, setNoturno } = useTheme();
  const { db, user, setPremium, resetDemo } = useApp();
  if (!user) return null;

  const minhasEntradas = db.entradas.filter((e) => e.user_id === user.id);
  const vouchers = db.vouchers.filter((v) => v.user_id === user.id);
  const nomeLiga = (id: string) =>
    db.ligas.find((l) => l.id === id)?.nome_jogo ?? "";

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Perfil" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="flex-row items-center">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-primary">
            <T className="font-mont-xb text-2xl text-onPrimary">
              {user.name[0]?.toUpperCase()}
            </T>
          </View>
          <View className="ml-3 flex-1">
            <T className="font-mont-xb text-lg">{user.name}</T>
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
          <T className="mt-1 text-xs text-fg/70">
            Use PONTOS para entrar nos palpites. Dentro deles você joga com FICHAS.
          </T>
        </View>

        <Card className="mt-3 flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-gold/15">
            <Ionicons name="diamond" size={20} color={C.gold} />
          </View>
          <View className="ml-3 flex-1">
            <T className="font-mont-b text-sm">Premium</T>
            <T className="text-xs text-muted">
              {user.is_premium
                ? "Ativo • sem anúncios"
                : "Remova todos os anúncios"}
            </T>
          </View>
          <Switch
            value={user.is_premium}
            onValueChange={setPremium}
            trackColor={{ false: C.line, true: C.gold }}
            thumbColor="#FFFFFF"
          />
        </Card>

        <Card className="mt-3 flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Ionicons
              name={noturno ? "moon" : "sunny"}
              size={20}
              color={C.primary}
            />
          </View>
          <View className="ml-3 flex-1">
            <T className="font-mont-b text-sm">Modo noturno</T>
            <T className="text-xs text-muted">
              {noturno ? "Tema escuro ativado" : "Tema claro (padrão)"}
            </T>
          </View>
          <Switch
            value={noturno}
            onValueChange={setNoturno}
            trackColor={{ false: C.line, true: C.primary }}
            thumbColor="#FFFFFF"
          />
        </Card>

        {vouchers.length > 0 ? (
          <>
            <SectionTitle>Meus vouchers</SectionTitle>
            {vouchers.map((v) => (
              <View key={v.id} className="mb-3">
                <VoucherCard voucher={v} nomeJogo={nomeLiga(v.liga_id)} />
              </View>
            ))}
          </>
        ) : null}

        <SectionTitle>Histórico de palpites</SectionTitle>
        {minhasEntradas.length === 0 ? (
          <Card>
            <T className="text-sm text-muted">Nenhum palpite ainda.</T>
          </Card>
        ) : (
          minhasEntradas.map((e) => {
            const liga = db.ligas.find((l) => l.id === e.liga_id);
            if (!liga) return null;
            const pos = calcularRanking(db, liga.id).find(
              (r) => r.user.id === user.id,
            );
            return (
              <Pressable
                key={e.id}
                onPress={() =>
                  router.push({
                    pathname: "/liga/[id]",
                    params: { id: liga.id },
                  })
                }
                className="mb-2 flex-row items-center rounded-xl border border-line bg-card p-3.5"
              >
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <T className="mr-2 font-mont-b text-sm">{liga.nome_jogo}</T>
                    <StatusBadge status={liga.status} />
                  </View>
                  <T className="mt-1 text-xs text-muted">
                    Entrada: -{e.pontos_pagos} PONTOS • {pos?.posicao}º lugar •{" "}
                    {fmtPts(pos?.pontuacao ?? 0)} pts
                  </T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </Pressable>
            );
          })
        )}

        <Button
          title="Resetar demo (sair)"
          variant="danger"
          icon="refresh"
          className="mt-8"
          onPress={resetDemo}
        />
        <T className="mt-2 text-center text-[11px] text-muted">
          Apaga os dados locais e volta pro cadastro.
        </T>
      </ScrollView>
    </View>
  );
}
