import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "../../components/AppHeader";
import { BetButton } from "../../components/BetButton";
import { useEntrarLiga } from "../../components/EntrarLiga";
import { VoucherCard, VoucherModal } from "../../components/Modals";
import {
  Button,
  Card,
  EmptyState,
  SectionTitle,
  StatusBadge,
  T,
} from "../../components/ui";
import { FICHAS_POR_LIGA } from "../../lib/constants";
import { fmtData, fmtOdd, fmtPts } from "../../lib/format";
import {
  calcularRanking,
  fichasDisponiveis,
  fichasUsadas,
  getEntrada,
  pontuacaoUsuario,
  round2,
} from "../../lib/rules";
import { errorMessage, useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import { PremioBox } from "../../components/PremioBox";

const toInt = (s: string | undefined) => {
  const n = parseInt((s ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export default function LigaScreen() {
  const { palette: C } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, user, apostar, finalizarLiga, voucherRecente, fecharVoucher } =
    useApp();
  const insets = useSafeAreaInsets();
  const { abrir, modal } = useEntrarLiga();
  const [dist, setDist] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [adminAberto, setAdminAberto] = useState(false);
  const [vencedores, setVencedores] = useState<string[]>([]);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  const liga = db.ligas.find((l) => l.id === id);
  const mercados = useMemo(
    () => db.mercados.filter((m) => m.liga_id === id),
    [db.mercados, id],
  );

  if (!liga || !user) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader back title="Palpite" />
        <View className="p-4">
          <EmptyState icon="alert-circle-outline" title="Palpite não encontrado" />
        </View>
      </View>
    );
  }

  const entrada = getEntrada(db, user.id, liga.id);
  const livres = fichasDisponiveis(db, user.id, liga.id);
  const usadas = fichasUsadas(db, user.id, liga.id);
  const minhasApostas = db.apostas.filter(
    (a) => a.user_id === user.id && a.liga_id === liga.id,
  );
  const fichasNoMercado = (mid: string) =>
    minhasApostas
      .filter((a) => a.mercado_id === mid)
      .reduce((s, a) => s + a.fichas_apostadas, 0);

  const total = Object.values(dist).reduce((s, v) => s + toInt(v), 0);
  const estourou = total > livres;
  const podeApostar = liga.status === "aberta" && !!entrada && livres > 0;
  const finalizada = liga.status === "finalizada";
  const ranking = calcularRanking(db, liga.id);
  const minhaPosicao = ranking.find((r) => r.user.id === user.id);
  const meuVoucher = db.vouchers.find(
    (v) => v.liga_id === liga.id && v.user_id === user.id,
  );
  const campeao = finalizada ? ranking[0] : undefined;

  const setFichas = (mid: string, v: string) => {
    setErro(null);
    setSucesso(null);
    setDist((d) => ({ ...d, [mid]: v.replace(/\D/g, "").slice(0, 3) }));
  };
  const restanteSemEste = (mid: string) => livres - (total - toInt(dist[mid]));
  const somar = (mid: string, delta: number) => {
    const atual = toInt(dist[mid]);
    const teto = Math.max(atual, restanteSemEste(mid));
    setFichas(mid, String(Math.max(0, Math.min(atual + delta, teto))));
  };

  const confirmar = () => {
    try {
      const payload = Object.fromEntries(
        Object.entries(dist).map(([k, v]) => [k, toInt(v)]),
      );
      apostar(liga.id, payload);
      setDist({});
      setErro(null);
      setSucesso(`${total} fichas distribuídas! Boa sorte.`);
    } catch (e) {
      setErro(errorMessage(e));
    }
  };

  const finalizar = () => {
    try {
      const v = finalizarLiga(liga.id, vencedores);
      const ganhador = v
        ? db.users.find((u) => u.id === v.user_id)?.name
        : null;
      setAdminMsg(
        ganhador
          ? `Palpite finalizado. Campeão: ${ganhador}.`
          : "Palpite finalizado. Ninguém pontuou.",
      );
      setAdminAberto(false);
    } catch (e) {
      setAdminMsg(errorMessage(e));
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppHeader back title={liga.nome_jogo} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <View className="flex-row items-center justify-between">
            <T className="font-mont-sb text-[11px] text-muted">
              {fmtData(liga.data_jogo)} • {liga.local}
            </T>
            <StatusBadge status={liga.status} />
          </View>
          <PremioBox premio={liga.premio_desc} size="lg" className="mt-3" />

          {entrada ? (
            <View className="mt-4">
              <View className="flex-row items-end justify-between">
                <View>
                  <T className="text-[10px] uppercase tracking-widest text-muted">
                    Suas fichas neste palpite
                  </T>
                  <T className="font-odds text-2xl text-primary">
                    {livres - (podeApostar ? Math.min(total, livres) : 0)}
                    <T className="font-mont-b text-sm text-muted">
                      {" "}
                      / {entrada.fichas_total} livres
                    </T>
                  </T>
                </View>
                <View className="items-end">
                  <T className="text-[10px] uppercase tracking-widest text-muted">
                    Pontuação
                  </T>
                  <T className="font-odds text-2xl">
                    {fmtPts(pontuacaoUsuario(db, user.id, liga.id))}
                  </T>
                </View>
              </View>
              <View className="mt-2 h-2 overflow-hidden rounded-full bg-cardAlt">
                <View
                  className={`h-full ${estourou ? "bg-danger" : "bg-primary"}`}
                  style={{
                    width: `${Math.min(100, ((usadas + (podeApostar ? total : 0)) / entrada.fichas_total) * 100)}%`,
                  }}
                />
              </View>
            </View>
          ) : liga.status === "aberta" ? (
            <View className="mt-4">
              <T className="text-sm text-fg/80">
                Pague{" "}
                <T className="font-mont-b text-fg">
                  {liga.custo_entrada} PONTOS
                </T>{" "}
                e receba{" "}
                <T className="font-mont-b text-primary">
                  {FICHAS_POR_LIGA} FICHAS
                </T>{" "}
                para distribuir nos mercados.
              </T>
              <Button
                title={`Entrar por ${liga.custo_entrada} PONTOS`}
                onPress={() => abrir(liga)}
                className="mt-3"
              />
            </View>
          ) : null}

          <Button
            title="Ver ranking do palpite"
            variant="ghost"
            icon="podium"
            className="mt-3"
            onPress={() =>
              router.push({ pathname: "/ranking", params: { ligaId: liga.id } })
            }
          />
        </Card>

        {finalizada ? (
          <>
            <SectionTitle>Resultado</SectionTitle>
            {campeao && campeao.pontuacao > 0 ? (
              <Card className="mb-3 flex-row items-center border-gold/40">
                <Ionicons name="trophy" size={26} color={C.gold} />
                <View className="ml-3 flex-1">
                  <T className="text-[10px] uppercase tracking-widest text-gold">
                    Campeão
                  </T>
                  <T className="font-mont-b text-base">
                    {campeao.user.id === user.id ? "Você!" : campeao.user.name}
                  </T>
                </View>
                <T className="font-odds text-xl text-primary">
                  {fmtPts(campeao.pontuacao)}
                </T>
              </Card>
            ) : null}
            {meuVoucher ? (
              <View className="mb-3">
                <VoucherCard voucher={meuVoucher} />
              </View>
            ) : entrada ? (
              <Card className="mb-3">
                <T className="text-sm text-fg/80">
                  Você terminou em{" "}
                  <T className="font-mont-b text-fg">
                    {minhaPosicao?.posicao}º
                  </T>
                  . Não foi dessa vez — os {liga.custo_entrada} PONTOS da
                  entrada ficaram no palpite.
                </T>
              </Card>
            ) : null}
          </>
        ) : null}

        <SectionTitle
          right={
            <T className="font-mont-sb text-xs text-muted">
              {mercados.length} mercados
            </T>
          }
        >
          Mercados
        </SectionTitle>

        {mercados.map((m) => {
          const jaApostado = fichasNoMercado(m.id);
          const valor = dist[m.id] ?? "";
          const n = toInt(valor);
          const selecionado = n > 0;
          return (
            <View
              key={m.id}
              className="mb-3 rounded-xl border border-line bg-card p-3"
            >
              <BetButton
                descricao={m.descricao}
                multiplicador={m.multiplicador}
                selected={selecionado}
                resultado={
                  finalizada ? (m.resultado_final ? "green" : "red") : null
                }
                disabled={!podeApostar}
                onPress={() =>
                  selecionado
                    ? setFichas(m.id, "")
                    : setFichas(
                        m.id,
                        String(
                          Math.min(10, Math.max(0, restanteSemEste(m.id))),
                        ),
                      )
                }
              />
              {jaApostado > 0 ? (
                <View className="mt-2 flex-row items-center">
                  <Ionicons name="lock-closed" size={12} color={C.primary} />
                  <T className="ml-1.5 font-mont-sb text-xs text-primary">
                    {jaApostado} fichas apostadas • retorno{" "}
                    {fmtPts(round2(jaApostado * m.multiplicador))} pts
                  </T>
                </View>
              ) : null}
              {podeApostar ? (
                <View className="mt-3 flex-row items-center">
                  <Pressable
                    onPress={() => somar(m.id, -10)}
                    className="h-10 w-10 items-center justify-center rounded-lg bg-cardAlt"
                  >
                    <Ionicons name="remove" size={18} color={C.fg} />
                  </Pressable>
                  <View className="mx-2 min-w-0 flex-1 flex-row items-center rounded-lg border border-line bg-bg px-3">
                    <TextInput
                      value={valor}
                      onChangeText={(t) => setFichas(m.id, t)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={C.muted}
                      className="min-w-0 flex-1 py-2 font-odds text-lg text-fg"
                    />
                    <T className="font-mont-b text-[10px] text-muted">FICHAS</T>
                  </View>
                  <Pressable
                    onPress={() => somar(m.id, 10)}
                    className="h-10 w-10 items-center justify-center rounded-lg bg-cardAlt"
                  >
                    <Ionicons name="add" size={18} color={C.fg} />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      setFichas(
                        m.id,
                        String(Math.max(0, restanteSemEste(m.id))),
                      )
                    }
                    className="ml-2 h-10 items-center justify-center rounded-lg border border-primary/50 px-2.5"
                  >
                    <T className="font-mont-xb text-[10px] text-primary">MAX</T>
                  </Pressable>
                </View>
              ) : null}
              {podeApostar && n > 0 ? (
                <T className="mt-2 text-right text-xs text-muted">
                  Se bater:{" "}
                  <T className="font-odds text-xs text-primary">
                    +{fmtPts(round2(n * m.multiplicador))} pts
                  </T>{" "}
                  ({n} × {fmtOdd(m.multiplicador)})
                </T>
              ) : null}
            </View>
          );
        })}

        {!finalizada ? (
          <View className="mt-4">
            <Pressable
              onPress={() => setAdminAberto((v) => !v)}
              className="flex-row items-center justify-between rounded-xl border border-dashed border-line p-3"
            >
              <View className="flex-row items-center">
                <Ionicons name="construct-outline" size={16} color={C.muted} />
                <T className="ml-2 font-mont-b text-xs text-muted">
                  PAINEL ADMIN (DEMO) • FINALIZAR PALPITE
                </T>
              </View>
              <Ionicons
                name={adminAberto ? "chevron-up" : "chevron-down"}
                size={16}
                color={C.muted}
              />
            </Pressable>
            {adminAberto ? (
              <Card className="mt-2">
                <T className="mb-3 text-xs text-fg/70">
                  Marque os mercados que bateram (resultado_final = true) e
                  finalize. O 1º do ranking recebe +{liga.custo_entrada} PONTOS
                  e o voucher.
                </T>
                {mercados.map((m) => {
                  const on = vencedores.includes(m.id);
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() =>
                        setVencedores((v) =>
                          on ? v.filter((x) => x !== m.id) : [...v, m.id],
                        )
                      }
                      className="mb-2 flex-row items-center"
                    >
                      <Ionicons
                        name={on ? "checkbox" : "square-outline"}
                        size={20}
                        color={on ? C.primary : C.muted}
                      />
                      <T className="ml-2 flex-1 font-mont-sb text-sm">
                        {m.descricao}
                      </T>
                      <T className="font-odds text-sm text-primary">
                        {fmtOdd(m.multiplicador)}
                      </T>
                    </Pressable>
                  );
                })}
                <Button
                  title="Finalizar palpite"
                  variant="danger"
                  icon="flag"
                  className="mt-2"
                  onPress={finalizar}
                />
              </Card>
            ) : null}
          </View>
        ) : null}
        {adminMsg ? (
          <T className="mt-3 text-center font-mont-sb text-xs text-muted">
            {adminMsg}
          </T>
        ) : null}
      </ScrollView>

      {podeApostar ? (
        <View
          style={{ paddingBottom: insets.bottom + 12 }}
          className="absolute bottom-0 left-0 right-0 border-t border-line bg-card px-4 pt-3"
        >
          {erro ? (
            <T className="mb-2 font-mont-sb text-xs text-danger">{erro}</T>
          ) : null}
          {sucesso && total === 0 ? (
            <T className="mb-2 font-mont-sb text-xs text-primary">{sucesso}</T>
          ) : null}
          <View className="flex-row items-center">
            <View className="mr-3">
              <T className="text-[10px] uppercase tracking-widest text-muted">
                Distribuindo
              </T>
              <T
                className={`font-odds text-xl ${estourou ? "text-danger" : "text-fg"}`}
              >
                {total}
                <T className="font-mont-b text-xs text-muted"> / {livres}</T>
              </T>
            </View>
            <Button
              title={estourou ? "Fichas insuficientes" : "Confirmar fichas"}
              disabled={total === 0 || estourou}
              onPress={confirmar}
              className="flex-1"
            />
          </View>
        </View>
      ) : null}
      {modal}
      <VoucherModal
        voucher={voucherRecente}
        nomeJogo={liga.nome_jogo}
        onClose={fecharVoucher}
      />
    </KeyboardAvoidingView>
  );
}
