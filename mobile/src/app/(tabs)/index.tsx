import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { FooterBanner, Interstitial } from "../../components/Ads";
import { BonusLogin } from "../../components/BonusLogin";
import { AppHeader } from "../../components/AppHeader";
import { BetButton } from "../../components/BetButton";
import { useEntrarLiga } from "../../components/EntrarLiga";
import {
  Button,
  Card,
  SectionTitle,
  StatusBadge,
  T,
} from "../../components/ui";
import {
  CUSTO_ENTRADA_PADRAO,
  FICHAS_POR_LIGA,
  SALDO_INICIAL_PONTOS,
} from "../../lib/constants";
import { fmtData, fmtPts } from "../../lib/format";
import {
  fichasDisponiveis,
  getEntrada,
  pontuacaoUsuario,
} from "../../lib/rules";
import { useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import { PremioBox } from "../../components/PremioBox";

export default function Home() {
  const { palette: C } = useTheme();
  const { db, user } = useApp();
  const { abrir, modal } = useEntrarLiga();
  if (!user) return null;

  const abertas = db.ligas.filter((l) => l.status === "aberta");
  const destaque = abertas[0];
  const minhas = db.ligas.filter((l) => getEntrada(db, user.id, l.id));
  const irParaLiga = (id: string) =>
    router.push({ pathname: "/liga/[id]", params: { id } });

  return (
    <View className="flex-1 bg-bg">
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <T className="text-sm text-muted">
          Fala, <T className="font-mont-b text-fg">{user.name.split(" ")[0]}</T>{" "}
          • {user.bairro}
        </T>

        {destaque ? (
          <View className="mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-card">
            <View className="flex-row items-center justify-between bg-primary/10 px-4 py-2">
              <View className="flex-row items-center">
                <Ionicons name="flame" size={14} color={C.primary} />
                <T className="ml-1.5 font-mont-xb text-[11px] uppercase tracking-widest text-primary">
                  Destaque
                </T>
              </View>
              <StatusBadge status={destaque.status} />
            </View>
            <Pressable className="p-4" onPress={() => irParaLiga(destaque.id)}>
              <T className="font-mont-sb text-[11px] text-muted">
                {fmtData(destaque.data_jogo)} • {destaque.local}
              </T>
              <T className="mt-1 font-mont-xb text-2xl">
                {destaque.nome_jogo.toUpperCase()}
              </T>
              <View className="mt-3 flex-row" style={{ gap: 8 }}>
                {db.mercados
                  .filter((m) => m.liga_id === destaque.id)
                  .slice(0, 3)
                  .map((m) => (
                    <BetButton
                      key={m.id}
                      compact
                      descricao={m.descricao}
                      multiplicador={m.multiplicador}
                      onPress={() => irParaLiga(destaque.id)}
                    />
                  ))}
              </View>
              <PremioBox
                premio={destaque.premio_desc}
                size="lg"
                className="mt-4"
              />
            </Pressable>
            <View className="px-4 pb-4">
              {getEntrada(db, user.id, destaque.id) ? (
                <Button
                  title="Ver meu palpite"
                  variant="outline"
                  icon="arrow-forward"
                  onPress={() => irParaLiga(destaque.id)}
                />
              ) : (
                <Button
                  title="PALPITAR AGORA"
                  onPress={() => abrir(destaque)}
                />
              )}
            </View>
          </View>
        ) : null}

        <SectionTitle
          right={
            <T
              className="font-mont-b text-xs text-primary"
              onPress={() => router.push("/ligas")}
            >
              Ver todas
            </T>
          }
        >
          Meus palpites
        </SectionTitle>
        {minhas.length === 0 ? (
          <Card className="items-center py-6">
            <Ionicons name="football-outline" size={30} color={C.muted} />
            <T className="mt-2 text-center font-mont-b">
              Você ainda não entrou em nenhum palpite
            </T>
            <T className="mt-1 text-center text-xs text-muted">
              Escolha um jogo e entre por {CUSTO_ENTRADA_PADRAO} PONTOS.
            </T>
          </Card>
        ) : (
          minhas.map((l) => {
            const livres = fichasDisponiveis(db, user.id, l.id);
            return (
              <Pressable
                key={l.id}
                onPress={() => irParaLiga(l.id)}
                className="mb-2 flex-row items-center rounded-xl border border-line bg-card p-3.5 active:opacity-80"
              >
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <T className="mr-2 font-mont-b text-sm">{l.nome_jogo}</T>
                    <StatusBadge status={l.status} />
                  </View>
                  <T className="mt-1 text-xs text-muted">
                    {l.status === "aberta"
                      ? `${livres} fichas livres de ${getEntrada(db, user.id, l.id)?.fichas_total ?? FICHAS_POR_LIGA}`
                      : `Pontuação: ${fmtPts(pontuacaoUsuario(db, user.id, l.id))}`}
                  </T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </Pressable>
            );
          })
        )}

        <SectionTitle>Como funciona</SectionTitle>
        <Card>
          {[
            [
              "wallet",
              "PONTOS",
              `Saldo do seu perfil. Você começa com ${SALDO_INICIAL_PONTOS}.`,
            ],
            [
              "enter",
              "ENTRADA",
              `Pague ${CUSTO_ENTRADA_PADRAO} PONTOS para entrar num palpite.`,
            ],
            [
              "layers",
              "FICHAS",
              `Dentro do palpite você recebe ${FICHAS_POR_LIGA} FICHAS para distribuir nos mercados.`,
            ],
            [
              "trophy",
              "RANKING",
              "Pontuação = fichas × odd dos mercados que bateram. 1º lugar leva prêmio + PONTOS de volta.",
            ],
          ].map(([ic, t, d]) => (
            <View key={t} className="mb-3 flex-row">
              <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Ionicons
                  name={ic as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={C.primary}
                />
              </View>
              <View className="ml-3 flex-1">
                <T className="font-mont-xb text-xs tracking-widest text-primary">
                  {t}
                </T>
                <T className="text-xs leading-4 text-fg/80">{d}</T>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
      <FooterBanner />
      <Interstitial />
      <BonusLogin />
      {modal}
    </View>
  );
}
