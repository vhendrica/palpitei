import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { Checkbox, ErrorBox, Field } from "../../components/Form";
import { Button, Card, EmptyState, T } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtData, fmtOdd } from "../../lib/format";
import { errorMessage } from "../../store/AppStore";
import { useTheme } from "../../store/Theme";
import type { Fixture } from "../../types";

type Custom = { descricao: string; multiplicador: string };

const di = (dias: number) => {
  const d = new Date(Date.now() + dias * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Criar desafio: título/visibilidade, jogos do pool, mercados (sugeridos ou manuais). */
export default function CriarDesafio() {
  const { palette: C } = useTheme();
  const [titulo, setTitulo] = useState("");
  const [publico, setPublico] = useState(false);
  const [dia, setDia] = useState(0);
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [marcados, setMarcados] = useState<Record<number, Set<number>>>({});
  const [custom, setCustom] = useState<Record<number, Custom[]>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setFixtures(null);
        setErro(null);
        setFixtures((await api.desafios.fixtures(di(dia))).fixtures);
      } catch (e) {
        setErro(errorMessage(e));
        setFixtures([]);
      }
    })();
  }, [dia]);

  const toggleJogo = useCallback((id: number) => {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const toggleMercado = useCallback((fid: number, idx: number) => {
    setMarcados((m) => {
      const s = new Set(m[fid] ?? []);
      if (s.has(idx)) s.delete(idx);
      else s.add(idx);
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
          .map((m, i) => ({ m, i }))
          .filter(({ i }) => marcados[fid]?.has(i))
          .map(({ m }) => ({ grupo: m.grupo ?? "", descricao: m.descricao, multiplicador: m.multiplicador }));
        const manuais = (custom[fid] ?? [])
          .filter((m) => m.descricao.trim() && Number(m.multiplicador) > 0)
          .map((m) => ({ descricao: m.descricao.trim(), multiplicador: Number(m.multiplicador) }));
        return { fixture_id: fid, mercados: [...sug, ...manuais] };
      });
      const r = await api.desafios.criar({
        titulo: titulo.trim() || undefined,
        publico,
        jogos,
      });
      router.replace(`/desafio/${r.id}`);
    } catch (e) {
      setErro(errorMessage(e));
      setSalvando(false);
    }
  }, [selecionados, marcados, custom, fixtures, titulo, publico]);

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Criar desafio" back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Field label="Nome (opcional)" value={titulo} onChangeText={setTitulo} placeholder="Desafio da galera" />
        <Checkbox
          checked={publico}
          onChange={setPublico}
          label="Público: aparece na aba Desafio pra qualquer um entrar"
        />
        {!publico ? (
          <T className="mb-3 -mt-1 text-xs text-muted">Privado: só entra quem receber o link.</T>
        ) : null}

        <View className="mb-3 flex-row">
          {["Hoje", "Amanhã", "+2 dias"].map((lbl, i) => (
            <Pressable
              key={i}
              onPress={() => setDia(i)}
              className={`mr-2 rounded-full border px-3 py-1.5 ${dia === i ? "border-primary bg-primary" : "border-line"}`}
            >
              <T className={`text-xs ${dia === i ? "text-onPrimary font-mont-b" : "text-muted"}`}>{lbl}</T>
            </Pressable>
          ))}
        </View>

        <ErrorBox erro={erro} />
        {fixtures && fixtures.length === 0 ? (
          <EmptyState icon="football-outline" title="Sem jogos no pool" subtitle="O admin ainda não importou os jogos desse dia." />
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
                    {f.campeonato} · {fmtData(f.data)} · {new Date(f.horario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </T>
                </View>
              </Pressable>
              {sel ? (
                <View className="mt-3 border-t border-line pt-3">
                  {sug.map((m, i) => {
                    const on = !!marcados[f.fixture_id]?.has(i);
                    return (
                      <Pressable
                        key={i}
                        className="flex-row items-center py-1.5"
                        onPress={() => toggleMercado(f.fixture_id, i)}
                      >
                        <Ionicons
                          name={on ? "checkbox" : "square-outline"}
                          size={20}
                          color={on ? C.primary : C.muted}
                        />
                        <T className="ml-2 flex-1 text-sm">
                          {m.grupo ? `${m.grupo}: ` : ""}
                          {m.descricao}
                        </T>
                        <T className="font-odds text-sm text-primary">{fmtOdd(m.multiplicador)}</T>
                      </Pressable>
                    );
                  })}
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

        {fixtures && fixtures.length > 0 ? (
          <Button
            title={`Criar desafio (${selecionados.length} ${selecionados.length === 1 ? "jogo" : "jogos"})`}
            onPress={criar}
            disabled={!podeSalvar}
            loading={salvando}
            className="mt-4"
          />
        ) : null}
      </ScrollView>
    </View>
  );
}