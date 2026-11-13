import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { HelpIcon } from "../../components/HelpIcon";
import { ErrorBox, Field } from "../../components/Form";
import { Ficha } from "../../components/Ficha";
import { Button, Card, EmptyState, Esqueleto, T } from "../../components/ui";
import { api } from "../../lib/api";
import { useDesktop } from "../../lib/desktop";
import { fmtDia, fmtOdd } from "../../lib/format";
import { ModalModo, type ModoDesafio } from "../../components/ModalModo";
import { secaoDo } from "../../lib/secoes";
import { errorMessage } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import { DatePicker } from "../../components/DatePicker";
import { agruparMercados, type Fixture } from "../../types";

type Custom = { descricao: string; multiplicador: string };

const di = (dias: number) => {
  const d = new Date(Date.now() + dias * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Criar desafio: título/visibilidade, jogos do pool, mercados (sugeridos ou manuais). */
export default function CriarDesafio() {
  const { palette: C } = useTheme();
  const [titulo, setTitulo] = useState("");
  const [fichas, setFichas] = useState("100");
  const { modo: modoParam } = useLocalSearchParams<{ modo?: string }>();
  const [modo, setModo] = useState<ModoDesafio>(modoParam === "duelo" ? "duelo" : "grupo");
  const [modalModo, setModalModo] = useState(false);
  const [publico, setPublico] = useState(false);
  // Uma data só: atalho (hoje/amanhã) ou a escolhida no calendário.
  const [data, setData] = useState(() => di(0));
  const [calendario, setCalendario] = useState(false);
  const desktop = useDesktop();
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [marcados, setMarcados] = useState<Record<number, Set<string>>>({});
  const [custom, setCustom] = useState<Record<number, Custom[]>>({});
  const [salvando, setSalvando] = useState(false);
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const [abertas, setAbertas] = useState<Record<number, Set<string>>>({});

  const toggleAberto = useCallback((fid: number) => {
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(fid)) n.delete(fid); else n.add(fid);
      return n;
    });
  }, []);

  const toggleSecaoAberta = useCallback((fid: number, sec: string) => {
    setAbertas((m) => {
      const s = new Set(m[fid] ?? []);
      if (s.has(sec)) s.delete(sec); else s.add(sec);
      return { ...m, [fid]: s };
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setFixtures(null);
        setErro(null);
        // Os jogos escolhidos eram de outra data: a seleção recomeça.
        setSelecionados([]);
        setMarcados({});
        setCustom({});
        setFixtures((await api.desafios.fixtures(data)).fixtures);
      } catch (e) {
        setErro(errorMessage(e));
        setFixtures([]);
      }
    })();
  }, [data]);

  const toggleJogo = useCallback((id: number) => {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    // Ao selecionar o jogo, todos os mercados já vêm marcados.
    setMarcados((m) => {
      if (m[id]) return m;
      const f = fixtures?.find((x) => x.fixture_id === id);
      const grupos = new Set((f?.mercados_sugeridos ?? []).map((x) => x.grupo ?? ""));
      return { ...m, [id]: grupos };
    });
  }, [fixtures]);

  const toggleMercado = useCallback((fid: number, grupo: string) => {
    setMarcados((m) => {
      const s = new Set(m[fid] ?? []);
      if (s.has(grupo)) s.delete(grupo);
      else s.add(grupo);
      return { ...m, [fid]: s };
    });
  }, []);

  // Seção: todos os grupos dela selecionados → desmarca todos; senão marca todos.
  const toggleSecao = useCallback((fid: number, grupos: { grupo: string }[]) => {
    setMarcados((m) => {
      const s = new Set(m[fid] ?? []);
      const todos = grupos.every((g) => s.has(g.grupo));
      for (const g of grupos) {
        if (todos) s.delete(g.grupo);
        else s.add(g.grupo);
      }
      return { ...m, [fid]: s };
    });
  }, []);

  const addCustom = useCallback((fid: number) => {
    setCustom((c) => ({ ...c, [fid]: [...(c[fid] ?? []), { descricao: "", multiplicador: "" }] }));
  }, []);

  const setCustomField = useCallback((fid: number, i: number, k: keyof Custom, v: string) => {
    setCustom((c) => {
      const arr = [...(c[fid] ?? [])];
      arr[i] = { ...arr[i], [k]: v };
      return { ...c, [fid]: arr };
    });
  }, []);

  const podeSalvar = useMemo(() => {
    if (selecionados.length === 0) return false;
    return selecionados.every((fid) => {
      const sug = marcados[fid]?.size ?? 0;
      const manuais = (custom[fid] ?? []).filter((m) => m.descricao.trim() && Number(m.multiplicador) > 0);
      return sug + manuais.length > 0;
    });
  }, [selecionados, marcados, custom]);

  const criar = useCallback(async () => {
    setSalvando(true);
    setErro(null);
    try {
      const jogos = selecionados.map((fid) => {
        const f = fixtures!.find((x) => x.fixture_id === fid)!;
        const sug = (f.mercados_sugeridos ?? [])
          .filter((m) => marcados[fid]?.has(m.grupo ?? ""))
          .map((m) => ({ grupo: m.grupo ?? "", descricao: m.descricao, multiplicador: m.multiplicador }));
        const manuais = (custom[fid] ?? [])
          .filter((m) => m.descricao.trim() && Number(m.multiplicador) > 0)
          .map((m) => ({ descricao: m.descricao.trim(), multiplicador: Number(m.multiplicador) }));
        return { fixture_id: fid, mercados: [...sug, ...manuais] };
      });
      const r = await api.desafios.criar({
        titulo: titulo.trim() || undefined,
        publico: modo === "duelo" ? false : publico,
        modo,
        fichas: Number(fichas) || undefined,
        jogos,
      });
      router.replace(`/desafio/${r.id}`);
    } catch (e) {
      setErro(errorMessage(e));
      setSalvando(false);
    }
  }, [selecionados, marcados, custom, fixtures, titulo, modo, publico, fichas]);

  const totalMercados = selecionados.reduce(
    (t, fid) =>
      t +
      (marcados[fid]?.size ?? 0) +
      (custom[fid] ?? []).filter((m) => m.descricao.trim() && Number(m.multiplicador) > 0).length,
    0,
  );
  const atalhos = [
    { rotulo: "Hoje", valor: di(0) },
    { rotulo: "Amanhã", valor: di(1) },
  ];
  const dataFora = !atalhos.some((a) => a.valor === data);

  const config = (
    <>
        <T className="mb-3 text-xs text-muted">
          {modo === "duelo" ? "Duelo: você + 1 adversário" : "Desafio em grupo"} —{" "}
          <T className="text-primary" onPress={() => setModalModo(true)}>
            trocar modo
          </T>
        </T>
        <View className="flex-row" style={{ gap: 8 }}>
          <View className="flex-1">
            <Field label="Nome (opcional)" value={titulo} onChangeText={setTitulo} placeholder="Desafio da galera" />
          </View>
          <View className="w-28">
            <Field
              label="Fichas"
              labelExtra={
                <View className="ml-1">
                  <HelpIcon
                    size={14}
                    texto={"Saldo inicial deste Desafio.\nNão gasta seus Pontos. Todo mundo começa com a mesma quantidade de fichas."}
                  />
                </View>
              }
              iconNode={<Ficha size={16} />}
              value={fichas}
              onChangeText={setFichas}
              placeholder="100"
              keyboardType="number-pad"
            />
          </View>
        </View>
        {modo === "duelo" ? (
          <View className="mb-3 flex-row items-center rounded-xl border border-line p-3">
            <Ionicons name="lock-closed-outline" size={18} color={C.muted} />
            <T className="ml-2 flex-1 text-xs text-muted">
              <T className="font-mont-b text-xs">Duelo é sempre privado</T>
              {"\n"}O link serve de convite pra 1 adversário. Quem entrar primeiro te enfrenta.
            </T>
          </View>
        ) : (
          <View className="mb-3">
            <View className="mb-1.5 flex-row items-center">
              <T className="flex-1 font-mont-sb text-xs uppercase tracking-wide text-muted">
                Quem pode entrar?
              </T>
            </View>
            <View className="flex-row" style={{ gap: 8 }}>
              {(
                [
                  { v: false, icon: "lock-closed-outline" as const, titulo: "Privado", texto: "Só entra quem tiver o link que você compartilhar" },
                  { v: true, icon: "earth-outline" as const, titulo: "Público", texto: "Qualquer um encontra e entra pela aba Desafio" },
                ]
              ).map((o) => {
                const on = publico === o.v;
                return (
                  <Pressable
                    key={o.titulo}
                    onPress={() => setPublico(o.v)}
                    className={`flex-1 flex-row items-center rounded-xl border p-2.5 ${on ? "border-primary" : "border-line"}`}
                  >
                    <Ionicons name={o.icon} size={17} color={on ? C.primary : C.muted} />
                    <View className="ml-2 flex-1" style={{ minWidth: 0 }}>
                      <T className={`text-xs font-mont-b ${on ? "text-primary" : ""}`}>{o.titulo}</T>
                      <T className="text-[10px] text-muted" style={{ flexWrap: "wrap" }}>
                        {o.texto}
                      </T>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

    </>
  );

  const jogos = (
    <>
        <T className="mb-1.5 font-mont-sb text-xs uppercase tracking-wide text-muted">Quando</T>
        <View className="mb-3 flex-row flex-wrap" style={{ gap: 6 }}>
          {[...atalhos, ...(dataFora ? [{ rotulo: fmtDia(data), valor: data }] : [])].map((a) => {
            const on = a.valor === data;
            return (
              <Pressable
                key={a.rotulo}
                onPress={() => setData(a.valor)}
                className={`rounded-full border px-3.5 py-2 ${on ? "border-primary bg-primary" : "border-line"}`}
              >
                <T className={`text-xs ${on ? "font-mont-b text-onPrimary" : "text-muted"}`}>{a.rotulo}</T>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setCalendario(true)}
            className="flex-row items-center rounded-full border border-line px-3.5 py-2"
          >
            <Ionicons name="calendar-outline" size={14} color={C.muted} />
            <T className="ml-1.5 text-xs text-muted">Outra data</T>
          </Pressable>
          <DatePicker
            visivel={calendario}
            onFechar={() => setCalendario(false)}
            onEscolher={setData}
          />
        </View>

        <ErrorBox erro={erro} />
        {fixtures === null ? <Esqueleto /> : null}
        {fixtures && fixtures.length > 0 ? (
          <T className="mb-2 font-mont-sb text-xs uppercase tracking-wide text-muted">
            Jogos de {fmtDia(data)} · {fixtures.length} {fixtures.length === 1 ? "disponível" : "disponíveis"}
          </T>
        ) : null}
        {fixtures && fixtures.length === 0 && !erro ? (
          <EmptyState icon="football-outline" title={`Sem jogos em ${fmtDia(data)}`} subtitle="Não encontramos partidas nessa data. Tente outro dia." />
        ) : null}
        {fixtures?.map((f) => {
          const sel = selecionados.includes(f.fixture_id);
          const sug = f.mercados_sugeridos ?? [];
          return (
            <Card key={f.fixture_id} className="mb-2">
              <Pressable className="flex-row items-center" onPress={() => toggleJogo(f.fixture_id)}>
                <Ionicons
                  name={sel ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={sel ? C.primary : C.muted}
                />
                <View className="ml-3 flex-1">
                  <T className="font-mont-b text-sm">
                    {f.time_casa} x {f.time_fora}
                  </T>
                  <T className="text-xs text-muted">
                    {f.campeonato} · {new Date(f.horario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </T>
                </View>
              </Pressable>
              {sel ? (
                <View className="mt-3 border-t border-line pt-3">
                  {(() => {
                    const grupos = agruparMercados(sug.map((m) => ({ ...m, grupo: m.grupo ?? "" })));
                    const secoes: { sec: string; grupos: typeof grupos }[] = [];
                    for (const g of grupos) {
                      const sec = secaoDo(g.grupo);
                      const ultima = secoes[secoes.length - 1];
                      if (ultima && ultima.sec === sec) ultima.grupos.push(g);
                      else secoes.push({ sec, grupos: [g] });
                    }
                    const marc = marcados[f.fixture_id] ?? new Set<string>();
                    const abertoJ = abertos.has(f.fixture_id);
                    return (
                      <>
                        <Pressable className="flex-row items-center py-1" onPress={() => toggleAberto(f.fixture_id)}>
                          <T className="flex-1 text-xs text-muted">
                            {marc.size} {marc.size === 1 ? "mercado" : "mercados"} selecionados
                          </T>
                          <T className="text-xs text-primary">{abertoJ ? "fechar" : "editar"}</T>
                          <Ionicons name={abertoJ ? "chevron-up" : "chevron-down"} size={15} color={C.primary} style={{ marginLeft: 4 }} />
                        </Pressable>
                        {abertoJ ? secoes.map(({ sec, grupos: gsec }) => {
                          const todas = gsec.every((x) => marc.has(x.grupo));
                          const aberta = abertas[f.fixture_id]?.has(sec) ?? false;
                          return (
                            <View key={sec} className="mt-2">
                              <View className="flex-row items-center">
                                <Pressable className="flex-1 flex-row items-center" onPress={() => toggleSecao(f.fixture_id, gsec)}>
                                  <Ionicons name={todas ? "checkbox" : "square-outline"} size={18} color={todas ? C.primary : C.muted} />
                                  <T className="ml-2 font-mont-xb text-sm text-primary">{sec}</T>
                                </Pressable>
                                <Pressable onPress={() => toggleSecaoAberta(f.fixture_id, sec)} hitSlop={8}>
                                  <Ionicons name={aberta ? "chevron-up" : "chevron-down"} size={15} color={C.muted} />
                                </Pressable>
                              </View>
                              {aberta ? gsec.map((g, gi) => {
                                const on = marc.has(g.grupo);
                                return (
                                  <Pressable
                                    key={g.grupo || `g${gi}`}
                                    className="flex-row items-start py-1.5 pl-6"
                                    onPress={() => toggleMercado(f.fixture_id, g.grupo)}
                                  >
                                    <Ionicons name={on ? "checkbox" : "square-outline"} size={18} color={on ? C.primary : C.muted} />
                                    <View className="ml-2 flex-1">
                                      <T className="text-sm font-mont-b">{g.grupo || g.opcoes[0]?.descricao}</T>
                                      <T className="text-xs text-muted">
                                        {g.opcoes.map((o) => `${o.descricao} ${fmtOdd(o.multiplicador)}`).join("  ·  ")}
                                      </T>
                                    </View>
                                  </Pressable>
                                );
                              }) : null}
                            </View>
                          );
                        }) : null}
                      </>
                    );
                  })()}
                  {(custom[f.fixture_id] ?? []).map((m, i) => (
                    <View key={`c${i}`} className="flex-row items-center py-1">
                      <View className="flex-1">
                        <Field
                          label={i === 0 ? "Mercado manual" : ""}
                          value={m.descricao}
                          onChangeText={(v) => setCustomField(f.fixture_id, i, "descricao", v)}
                          placeholder="Ex.: Casa vence"
                        />
                      </View>
                      <View className="ml-2 w-20">
                        <Field
                          label={i === 0 ? "Odd" : ""}
                          value={m.multiplicador}
                          onChangeText={(v) => setCustomField(f.fixture_id, i, "multiplicador", v)}
                          placeholder="2.50"
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  ))}
                  <Pressable className="mt-1 flex-row items-center py-1" onPress={() => addCustom(f.fixture_id)}>
                    <Ionicons name="add-circle-outline" size={18} color={C.primary} />
                    <T className="ml-1 text-xs text-primary">Mercado manual</T>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          );
        })}

    </>
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Criar desafio" back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {desktop ? (
          <View style={{ maxWidth: 1180, width: "100%", alignSelf: "center", flexDirection: "row", alignItems: "flex-start", gap: 24 }}>
            <View style={[{ width: 340 }, { position: "sticky", top: 16 } as object]}>{config}</View>
            <View style={{ flex: 1, minWidth: 0 }}>{jogos}</View>
          </View>
        ) : (
          <>
            {config}
            {jogos}
          </>
        )}
      </ScrollView>
      {/* Rodapé fixo: o resumo e o botão ficam sempre à vista, não no fim da lista. */}
      <View className="border-t border-line bg-card px-4 py-2.5">
        <View
          className="flex-row items-center"
          style={desktop ? { maxWidth: 1180, width: "100%", alignSelf: "center" } : undefined}
        >
          <View className="flex-1 pr-3">
            <T className="font-mont-b text-sm">
              {selecionados.length === 0
                ? "Escolha os jogos"
                : `${selecionados.length} ${selecionados.length === 1 ? "jogo" : "jogos"} · ${totalMercados} ${totalMercados === 1 ? "mercado" : "mercados"}`}
            </T>
            <T className="text-[11px] text-muted" numberOfLines={1}>
              {modo === "duelo" ? "Duelo · privado" : `Em grupo · ${publico ? "público" : "privado"}`} ·{" "}
              {Number(fichas) || 100} fichas
            </T>
          </View>
          <Button title="Criar desafio" onPress={criar} disabled={!podeSalvar} loading={salvando} compact={!desktop} />
        </View>
      </View>
      <ModalModo visivel={modalModo} onFechar={() => setModalModo(false)} onEscolher={(m) => { setModalModo(false); setModo(m); }} />
    </View>
  );
}