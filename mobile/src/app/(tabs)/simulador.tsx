import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { ErrorBox, Field } from "../../components/Form";
import { Button, Card, Esqueleto, SectionTitle, T } from "../../components/ui";
import { track } from "../../lib/analytics";
import { api } from "../../lib/api";
import { incompativeis, oddTotal, type OpcaoCompat } from "../../lib/compat";
import { useDesktop } from "../../lib/desktop";
import { fmtOdd } from "../../lib/format";
import { errorMessage, useApp } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import { agruparMercados, type Jogo, type Mercado, type SimResumo } from "../../types";

/** Cinza-azulado do simulador: separa visualmente do verde da liga real. */
const SIM = "#7C8DA6";
const REAIS = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const CHIPS_RECARGA = [50_00, 200_00, 500_00];
const CHIPS_APOSTA = [10_00, 25_00, 50_00, 100_00, 250_00];

export default function Simulador() {
  const { user } = useApp();
  const { palette: C } = useTheme();
  const desktop = useDesktop();
  const [r, setR] = useState<SimResumo | null>(null);
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [cupom, setCupom] = useState<{ m: Mercado; j: Jogo }[]>([]);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const estourouJa = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const [res, h] = await Promise.all([api.sim.resumo(), api.home()]);
      setR(res);
      setJogos(h.jogos.filter((j) => !j.finalizado && !j.comecou));
    } catch (e) {
      setErro(errorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      track("Abriu simulador");
      carregar();
    }, [carregar]),
  );

  const conta = r?.conta;
  const bancaZerada = !!conta && conta.depositado > 0 && conta.saldo === 0 && conta.abertas_n === 0;

  useEffect(() => {
    if (bancaZerada && !estourouJa.current && conta) {
      estourouJa.current = true;
      track("Estourou banca virtual", { recargas: conta.recargas, depositado: conta.depositado });
    }
    if (conta && conta.saldo > 0) estourouJa.current = false;
  }, [bancaZerada, conta]);

  const recarregar = async (valor: number) => {
    setBusy(true);
    setErro(null);
    try {
      const res = await api.sim.recarga(valor);
      track(conta?.depositado ? "Recarregou banca virtual" : "Começou simulação", { valor });
      await carregar();
      return res;
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const opc = (m: Mercado, j: Jogo): OpcaoCompat => ({
    jogo_id: j.id,
    time_casa: j.time_casa,
    time_fora: j.time_fora,
    grupo: m.grupo ?? "",
    descricao: m.descricao,
  });

  /** Mercados que não podem entrar no cupom (incompatíveis com o que já está lá). */
  const bloqueados = new Set<string>();
  for (const j of jogos) {
    for (const m of j.mercados) {
      if (cupom.some((c) => c.m.id !== m.id && incompativeis(opc(m, j), opc(c.m, c.j)))) {
        bloqueados.add(m.id);
      }
    }
  }

  const toggleCupom = (m: Mercado, j: Jogo) => {
    setErro(null);
    if (cupom.some((c) => c.m.id === m.id)) {
      setCupom(cupom.filter((c) => c.m.id !== m.id));
    } else if (bloqueados.has(m.id)) {
      setErro("Palpite incompatível com o que já está no cupom.");
    } else {
      setCupom([...cupom, { m, j }]);
    }
  };

  const oddCupom = cupom.length
    ? cupom.length === 1
      ? cupom[0].m.multiplicador
      : oddTotal(cupom.map((c) => c.m.multiplicador))
    : 0;

  const apostar = async (valor: number) => {
    if (!cupom.length) return;
    setBusy(true);
    try {
      await api.sim.apostar(cupom.map((c) => c.m.id), valor);
      track("Apostou no simulador", { valor, odd: oddCupom, pernas: cupom.length });
      setCupom([]);
      setSheet(false);
      await carregar();
    } catch (e) {
      setErro(errorMessage(e));
      setSheet(false);
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Simulador" />
        <View className="p-4">
          <Card>
            <T className="text-sm text-muted">Entre na sua conta pra usar o simulador.</T>
          </Card>
        </View>
      </View>
    );
  }

  const primeiroUso = !!conta && conta.depositado === 0;

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Simulador" />
      <ScrollView
        contentContainerStyle={[
          { padding: 16, paddingBottom: cupom.length ? 120 : 48 },
          desktop ? { maxWidth: 560, width: "100%", alignSelf: "center" } : null,
        ]}
      >
        <View className="mb-3 flex-row items-center justify-between">
          <View />
          <View
            className="rounded-md border px-2 py-1"
            style={{ borderColor: C.line, backgroundColor: C.cardAlt }}
          >
            <T className="font-mont-b tracking-widest" style={{ color: SIM, fontSize: 9 }}>
              SEM VALOR REAL
            </T>
          </View>
        </View>
        <ErrorBox erro={erro} />
        {r == null && !erro ? <Esqueleto blocos={3} /> : null}

        {primeiroUso ? (
          <Onboarding
            busy={busy}
            onComecar={(v) => {
              recarregar(v);
            }}
          />
        ) : conta ? (
          <>
            <Card>
              <T className="text-xs text-muted">Banca virtual</T>
              <T className="font-mont-b text-3xl">{REAIS(conta.saldo)}</T>
              <T
                className="font-mont-b mt-1 text-sm"
                style={{ color: conta.pl < 0 ? C.danger : C.muted }}
              >
                {conta.pl >= 0 ? "+" : "−"}
                {REAIS(Math.abs(conta.pl))} acumulado
              </T>
            </Card>

            {bancaZerada ? <BancaZerada conta={conta} busy={busy} onRecarga={recarregar} /> : null}

            <View className="mt-3 flex-row gap-2">
              <Stat v={REAIS(conta.depositado)} k='total "depositado"' />
              <Stat v={REAIS(conta.apostado)} k="total apostado" />
            </View>
            <View className="mt-2 flex-row gap-2">
              <Stat
                v={`${conta.roi}%`}
                k="seu ROI"
                cor={conta.roi < 0 ? C.danger : undefined}
              />
              <Stat v={String(r.apostas.length)} k="apostas recentes" />
            </View>

            {conta.dias >= 7 && conta.pl < 0 ? (
              <View
                className="mt-3 rounded-2xl border border-line bg-card p-4"
                style={{ borderLeftWidth: 3, borderLeftColor: C.danger }}
              >
                <T className="text-xs text-muted">Nesse ritmo, em 1 ano</T>
                <T className="font-mont-b text-lg" style={{ color: C.danger }}>
                  −{REAIS(Math.abs(conta.projecao_anual))}
                </T>
                <T className="mt-1 text-xs text-muted">
                  Na poupança, os mesmos {REAIS(conta.depositado)} renderiam{" "}
                  <T className="font-mont-b">+{REAIS(conta.vs_poupanca)}</T>
                </T>
              </View>
            ) : null}

            <SectionTitle>Recarregar banca</SectionTitle>
            <View className="flex-row gap-2">
              {CHIPS_RECARGA.map((v) => (
                <Pressable
                  key={v}
                  disabled={busy}
                  onPress={() => recarregar(v)}
                  className="flex-1 items-center rounded-lg border py-2.5"
                  style={{ borderColor: C.line, backgroundColor: C.cardAlt, opacity: busy ? 0.5 : 1 }}
                >
                  <T className="font-mont-b text-xs">+{REAIS(v)}</T>
                </Pressable>
              ))}
            </View>

            {jogos.length ? (
              <>
                <SectionTitle>Jogos de hoje</SectionTitle>
                <T className="mb-1 text-xs text-muted">
                  Toque nas odds pra montar o cupom — 2+ palpites viram múltipla.
                </T>
                {jogos.map((j) => (
                  <JogoSim
                    key={j.id}
                    jogo={j}
                    selecionados={new Set(cupom.map((c) => c.m.id))}
                    bloqueados={bloqueados}
                    onToggle={toggleCupom}
                  />
                ))}
              </>
            ) : null}

            {r.apostas.length ? (
              <>
                <SectionTitle>Minhas apostas</SectionTitle>
                <Card>
                  {r.apostas.map((a, i) => (
                    <View
                      key={a.id}
                      className="py-2"
                      style={i ? { borderTopWidth: 1, borderTopColor: C.line } : null}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-2">
                          <T className="font-mont-b text-xs">{a.mercado}</T>
                          {a.tipo === "simples" ? (
                            <T className="text-xs text-muted">{a.jogo}</T>
                          ) : null}
                        </View>
                        <T className="font-mont-b text-xs">
                          {REAIS(a.valor)} @ {fmtOdd(a.odd)}
                        </T>
                        <T
                          className="ml-3 w-16 text-right font-mont-b text-xs"
                          style={{
                            color:
                              a.status === "perdeu"
                                ? C.danger
                                : a.status === "anulada"
                                  ? C.muted
                                  : C.fg,
                          }}
                        >
                          {a.status === "aberta"
                            ? "ABERTA"
                            : a.status === "ganhou"
                              ? `+${REAIS(a.retorno)}`
                              : a.status === "perdeu"
                                ? `−${REAIS(a.valor)}`
                                : "ANULADA"}
                        </T>
                      </View>
                      {a.pernas?.map((p, pi) => (
                        <View key={pi} className="mt-1 flex-row items-center justify-between pl-3">
                          <T className="flex-1 text-muted" style={{ fontSize: 10 }}>
                            {p.mercado} · {p.jogo}
                          </T>
                          <T className="text-muted" style={{ fontSize: 10 }}>
                            {fmtOdd(p.odd)}
                          </T>
                          <T
                            className="ml-2 font-mont-b"
                            style={{
                              fontSize: 9,
                              color: p.status === "perdeu" ? C.danger : p.status === "ganhou" ? C.fg : C.muted,
                            }}
                          >
                            {p.status === "aberta" ? "..." : p.status === "ganhou" ? "✓" : "✗"}
                          </T>
                        </View>
                      ))}
                    </View>
                  ))}
                </Card>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {cupom.length ? (
        <View
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            maxWidth: 536,
            alignSelf: "center",
            width: "100%",
          }}
        >
          <Pressable
            onPress={() => setSheet(true)}
            className="flex-row items-center justify-between rounded-2xl border px-4 py-3"
            style={{ borderColor: SIM, backgroundColor: C.card }}
          >
            <View>
              <T className="font-mont-b text-xs">
                {cupom.length === 1 ? "1 palpite" : `Múltipla · ${cupom.length} palpites`}
              </T>
              <T className="text-xs text-muted">odd total {fmtOdd(oddCupom)}</T>
            </View>
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => setCupom([])} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={C.muted} />
              </Pressable>
              <View className="rounded-lg px-3 py-2" style={{ backgroundColor: SIM }}>
                <T className="font-mont-b text-xs" style={{ color: "#fff" }}>
                  Simular
                </T>
              </View>
            </View>
          </Pressable>
        </View>
      ) : null}

      {sheet && cupom.length ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => setSheet(false)}>
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
            onPress={() => setSheet(false)}
          >
            <CupomSheet
              cupom={cupom}
              odd={oddCupom}
              busy={busy}
              onRemover={(id) => setCupom(cupom.filter((c) => c.m.id !== id))}
              onConfirmar={apostar}
            />
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

function Stat({ v, k, cor }: { v: string; k: string; cor?: string }) {
  const { palette: C } = useTheme();
  return (
    <View className="flex-1 rounded-xl border p-3" style={{ borderColor: C.line, backgroundColor: C.card }}>
      <T className="font-mont-b text-sm" style={cor ? { color: cor } : null}>
        {v}
      </T>
      <T className="mt-1 text-xs text-muted">{k}</T>
    </View>
  );
}

/** Primeiro acesso: explica o modo e define a banca inicial. */
function Onboarding({ busy, onComecar }: { busy: boolean; onComecar: (v: number) => void }) {
  const { palette: C } = useTheme();
  const [valor, setValor] = useState(500_00);
  const [outro, setOutro] = useState("");
  const chips = [100_00, 500_00, 1000_00];
  return (
    <>
      <Card>
        <T className="font-mont-b text-base">Como funciona</T>
        <T className="mt-2 text-sm leading-5 text-muted">
          Você aposta <T className="font-mont-b text-fg">dinheiro virtual</T> nos jogos de
          verdade, com as <T className="font-mont-b text-fg">odds reais</T> das casas. No fim,
          o app mostra quanto você teria ganho — ou perdido.
        </T>
        <T className="mt-2 text-sm leading-5 text-muted">
          Nenhum valor real entra ou sai. Os dados ficam guardados pra você acompanhar a
          evolução.
        </T>
      </Card>
      <Card>
        <T className="text-xs text-muted">Com quanto você “depositaria” pra começar?</T>
        <T className="mt-1 text-xs text-muted">
          Escolha o valor que costuma colocar em app de aposta
        </T>
        <View className="mt-3 flex-row gap-2">
          {chips.map((v) => (
            <Pressable
              key={v}
              onPress={() => {
                setValor(v);
                setOutro("");
              }}
              className="flex-1 items-center rounded-lg border py-2.5"
              style={{
                borderColor: valor === v ? SIM : C.line,
                backgroundColor: C.cardAlt,
              }}
            >
              <T className="font-mont-b text-xs">{REAIS(v)}</T>
            </Pressable>
          ))}
        </View>
        <Field
          label="Outro valor (R$)"
          value={outro}
          keyboardType="numeric"
          onChangeText={(t) => {
            const n = parseInt(t.replace(/\D/g, ""), 10);
            setOutro(t);
            if (n > 0) setValor(n * 100);
          }}
        />
      </Card>
      <Button
        title={`Começar com ${REAIS(valor)}`}
        loading={busy}
        onPress={() => onComecar(valor)}
      />
      <T className="mt-2 text-center text-xs text-muted">
        Simulação educativa — sem dinheiro real, sem prêmio.
      </T>
    </>
  );
}

/** Card do momento "banca zerada": o insight mais importante do modo. */
function BancaZerada({
  conta,
  busy,
  onRecarga,
}: {
  conta: SimResumo["conta"];
  busy: boolean;
  onRecarga: (v: number) => Promise<{ estourou: boolean } | undefined>;
}) {
  const { palette: C } = useTheme();
  return (
    <Card className="mt-3 items-center">
      <Ionicons name="cash-outline" size={30} color={C.muted} />
      <T className="mt-2 text-center font-mont-b text-base">
        Sua banca zerou{conta.dias ? ` em ${conta.dias} dias` : ""}
      </T>
      <T className="mt-2 text-center text-sm leading-5 text-muted">
        Você “depositou” <T className="font-mont-b text-fg">{REAIS(conta.depositado)}</T> e
        perdeu tudo.{conta.estouros > 1 ? ` É a ${conta.estouros}ª vez que isso acontece.` : ""}
      </T>
      <T className="mt-2 text-center text-sm leading-5 text-muted">
        Apostadores reais recarregam exatamente aqui — é nesse momento que vira ciclo.
      </T>
      <View className="mt-3 flex-row gap-2 self-stretch">
        {CHIPS_RECARGA.map((v) => (
          <Pressable
            key={v}
            disabled={busy}
            onPress={() => onRecarga(v)}
            className="flex-1 items-center rounded-lg border py-2.5"
            style={{ borderColor: C.line, backgroundColor: C.cardAlt }}
          >
            <T className="font-mont-b text-xs">+{REAIS(v)}</T>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => Linking.openURL("https://jogadoresanonimos.com.br")}>
        <T className="mt-3 text-xs underline" style={{ color: SIM }}>
          Precisa de ajuda? jogadoresanonimos.com.br
        </T>
      </Pressable>
    </Card>
  );
}

function JogoSim({
  jogo,
  selecionados,
  bloqueados,
  onToggle,
}: {
  jogo: Jogo;
  selecionados: Set<string>;
  bloqueados: Set<string>;
  onToggle: (m: Mercado, j: Jogo) => void;
}) {
  const { palette: C } = useTheme();
  const grupos = agruparMercados(jogo.mercados.filter((m) => !m.decidido && m.multiplicador > 1));
  if (!grupos.length) return null;
  return (
    <Card>
      <T className="font-mont-b text-sm">
        {jogo.time_casa} × {jogo.time_fora}
      </T>
      <T className="mt-0.5 text-xs text-muted">{jogo.campeonato}</T>
      {grupos.map((g) => (
        <View key={g.grupo} className="mt-3">
          {g.grupo ? <T className="mb-1 text-xs text-muted">{g.grupo}</T> : null}
          <View className="flex-row flex-wrap gap-2">
            {g.opcoes.map((m) => {
              const ativo = selecionados.has(m.id);
              const bloqueado = !ativo && bloqueados.has(m.id);
              return (
                <Pressable
                  key={m.id}
                  onPress={() => onToggle(m, jogo)}
                  className="min-w-[30%] flex-1 items-center rounded-lg border px-2 py-2"
                  style={{
                    borderColor: ativo ? SIM : C.line,
                    backgroundColor: ativo ? SIM : C.cardAlt,
                    opacity: bloqueado ? 0.35 : 1,
                  }}
                >
                  <T className="font-mont-b text-xs" style={ativo ? { color: "#fff" } : null}>
                    {fmtOdd(m.multiplicador)}
                  </T>
                  <T
                    className="mt-0.5 text-center text-muted"
                    style={{ fontSize: 9, color: ativo ? "#E8EDF4" : undefined }}
                  >
                    {m.descricao}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </Card>
  );
}

/** Sheet do cupom: lista as pernas, valor e confirma simples (1) ou múltipla (2+). */
function CupomSheet({
  cupom,
  odd,
  busy,
  onRemover,
  onConfirmar,
}: {
  cupom: { m: Mercado; j: Jogo }[];
  odd: number;
  busy: boolean;
  onRemover: (mercadoId: string) => void;
  onConfirmar: (v: number) => void;
}) {
  const { palette: C } = useTheme();
  const [valor, setValor] = useState(100_00);
  const multipla = cupom.length > 1;
  const retorno = Math.round(valor * odd);
  return (
    <Pressable
      style={{
        backgroundColor: C.card,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        padding: 16,
      }}
      onPress={(e) => e.stopPropagation()}
    >
      {multipla ? (
        <T className="mb-2 text-center font-mont-b text-xs" style={{ color: SIM }}>
          MÚLTIPLA · {cupom.length} PALPITES
        </T>
      ) : null}
      {cupom.map((c) => (
        <View key={c.m.id} className="flex-row items-center justify-between py-1">
          <T className="flex-1 text-xs text-muted">
            {c.m.descricao} · {c.j.time_casa} × {c.j.time_fora}
          </T>
          <T className="font-mont-b text-xs">{fmtOdd(c.m.multiplicador)}</T>
          <Pressable onPress={() => onRemover(c.m.id)} hitSlop={8} className="ml-2">
            <Ionicons name="close" size={14} color={C.muted} />
          </Pressable>
        </View>
      ))}
      {multipla ? (
        <T className="mt-1 text-center text-xs text-muted">
          odd total <T className="font-mont-b text-fg">{fmtOdd(odd)}</T> — errando 1, perde
          tudo
        </T>
      ) : null}
      <T className="my-3 text-center font-mont-b text-3xl">{REAIS(valor)}</T>
      <View className="flex-row gap-2">
        {CHIPS_APOSTA.map((v) => (
          <Pressable
            key={v}
            onPress={() => setValor(v)}
            className="flex-1 items-center rounded-lg border py-2.5"
            style={{ borderColor: valor === v ? SIM : C.line, backgroundColor: C.cardAlt }}
          >
            <T className="font-mont-b" style={{ fontSize: 10 }}>
              {REAIS(v)}
            </T>
          </Pressable>
        ))}
      </View>
      <T className="mt-3 text-center text-xs text-muted">
        Se ganhar: retorna {REAIS(retorno)} · Se perder: −{REAIS(valor)}
      </T>
      <Button
        title={multipla ? "Simular múltipla" : "Simular aposta"}
        loading={busy}
        className="mt-3"
        onPress={() => onConfirmar(valor)}
      />
      <T className="mt-2 text-center text-xs text-muted">
        Aposta simulada — nenhum valor real envolvido.
      </T>
    </Pressable>
  );
}
