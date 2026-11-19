import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { fmtOdd } from "../lib/format";
import { secaoDo } from "../lib/secoes";
import { useTheme } from "../store/Theme";
import { Button, T } from "./ui";

type Opcao = { descricao: string; multiplicador: number; categoria?: string };
export type GrupoSel = { grupo: string; opcoes: Opcao[] };

const CATEGORIAS = ["TODOS", "RESULTADO", "GOLS", "HANDICAP", "ESCANTEIOS", "CARTÕES", "JOGADOR", "OUTROS"] as const;
const NOMES: Record<string, string> = {
  TODOS: "Todos",
  RESULTADO: "Resultado",
  GOLS: "Gols",
  HANDICAP: "Handicap",
  ESCANTEIOS: "Escanteios",
  "CARTÕES": "Cartões",
  JOGADOR: "Jogador",
  OUTROS: "Outros",
};
/** Grupos que já vão no "Principais" (mesma lista do backend). */
const PRINCIPAIS = ["RESULTADO", "AMBOS MARCAM", "DUPLA CHANCE", "EMPATE ANULA", "GOLS 1.5", "GOLS 2.5", "GOLS 3.5"];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

/** Aba do grupo = a mesma seção que o usuário vê na tela de palpite. */
export function categoriaDo(g: GrupoSel): string {
  const c = g.opcoes[0]?.categoria;
  if (c === "JOGADOR") return "JOGADOR";
  return secaoDo(g.grupo);
}

/** Família do grupo sem a linha: "GOLS 2.5" e "GOLS 3.5" ficam juntos em "GOLS". */
const familia = (g: string) => g.replace(/\s[+-]?\d+(?:\.\d+)?$/, "");

/**
 * Seletor de mercados da API pensado pra centenas de opções: abas por tipo, busca, famílias recolhidas
 * (GOLS 0.5…5.5 numa linha só) e atalho "Principais".
 */
export function SeletorMercados({
  grupos,
  marcado,
  onToggle,
  onMarcar,
}: {
  grupos: GrupoSel[];
  marcado: (g: GrupoSel) => boolean;
  onToggle: (g: GrupoSel) => void;
  /** Marca (true) ou desmarca (false) uma lista inteira de grupos de uma vez. */
  onMarcar: (gs: GrupoSel[], marcar: boolean) => void;
}) {
  const { palette: C } = useTheme();
  const [cat, setCat] = useState<string>("TODOS");
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const contagem = useMemo(() => {
    const n: Record<string, number> = { TODOS: grupos.length };
    for (const g of grupos) n[categoriaDo(g)] = (n[categoriaDo(g)] ?? 0) + 1;
    return n;
  }, [grupos]);

  const q = norm(busca.trim());
  const visiveis = grupos.filter(
    (g) =>
      (cat === "TODOS" || categoriaDo(g) === cat) &&
      (!q || norm(g.grupo).includes(q) || g.opcoes.some((o) => norm(o.descricao).includes(q))),
  );
  const familias: { nome: string; grupos: GrupoSel[] }[] = [];
  for (const g of visiveis) {
    const nome = familia(g.grupo);
    const f = familias.find((x) => x.nome === nome);
    if (f) f.grupos.push(g);
    else familias.push({ nome, grupos: [g] });
  }
  const totalMarcados = grupos.filter(marcado).length;
  const principais = grupos.filter((g) => PRINCIPAIS.includes(g.grupo));

  return (
    <View>
      <View className="flex-row items-center rounded-lg border border-line px-2">
        <Ionicons name="search" size={14} color={C.muted} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar mercado ou jogador"
          placeholderTextColor={C.muted}
          className="flex-1 px-2 py-2 font-mont text-sm text-fg"
        />
        {busca ? (
          <Pressable onPress={() => setBusca("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={C.muted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
        {CATEGORIAS.filter((c) => c === "TODOS" || contagem[c]).map((c) => (
          <Pressable
            key={c}
            onPress={() => setCat(c)}
            className={`mr-1.5 rounded-full px-3 py-1.5 ${cat === c ? "bg-primary" : "bg-cardAlt"}`}
          >
            <T className={`text-xs ${cat === c ? "font-mont-b text-onPrimary" : ""}`}>
              {NOMES[c]} {contagem[c] ?? 0}
            </T>
          </Pressable>
        ))}
      </ScrollView>
      <View className="mt-2 flex-row items-center justify-between">
        <T className="text-xs text-muted">{totalMarcados} marcado(s)</T>
        <View className="flex-row">
          <Button
            compact
            variant="ghost"
            icon="checkmark-done-outline"
            title="Marcar visíveis"
            onPress={() => onMarcar(visiveis, true)}
          />
          <Button
            compact
            variant="ghost"
            icon="close-outline"
            title="Limpar"
            onPress={() => onMarcar(visiveis, false)}
          />
          {principais.length ? (
            <Button
              compact
              variant="ghost"
              icon="flash-outline"
              title="Principais"
              onPress={() => onMarcar(principais, true)}
            />
          ) : null}
        </View>
      </View>
      {familias.length === 0 ? <T className="mt-2 text-sm text-muted">Nenhum mercado encontrado.</T> : null}
      {familias.map((f) => {
        const aberto = abertos[f.nome] ?? (!!q || f.grupos.length === 1);
        const nMarc = f.grupos.filter(marcado).length;
        const todos = nMarc === f.grupos.length;
        return (
          <View key={f.nome} className="border-b border-line">
            <View className="flex-row items-center py-2">
              <Pressable
                onPress={() => setAbertos((s) => ({ ...s, [f.nome]: !aberto }))}
                className="flex-1 flex-row items-center"
              >
                <Ionicons name={aberto ? "chevron-down" : "chevron-forward"} size={14} color={C.muted} />
                <T className="ml-1 flex-1 font-mont-xb text-xs">{f.nome}</T>
                <T className="text-[11px] text-muted">
                  {nMarc ? `${nMarc}/` : ""}
                  {f.grupos.length > 1 ? `${f.grupos.length} linhas` : `${f.grupos[0].opcoes.length} opções`}
                </T>
              </Pressable>
              <Pressable
                onPress={() => onMarcar(f.grupos, !todos)}
                hitSlop={8}
                className="ml-2 flex-row items-center"
                accessibilityLabel={todos ? `Desmarcar todos ${f.nome}` : `Marcar todos ${f.nome}`}
              >
                <Ionicons
                  name={todos ? "checkbox" : nMarc ? "remove-circle-outline" : "square-outline"}
                  size={18}
                  color={nMarc ? C.primary : C.muted}
                />
                <T className={`ml-1 text-[11px] ${nMarc ? "text-primary" : "text-muted"}`}>todos</T>
              </Pressable>
            </View>
            {aberto
              ? f.grupos.map((g) => {
                  const ja = marcado(g);
                  return (
                    <Pressable
                      key={g.grupo}
                      onPress={() => onToggle(g)}
                      className={`mb-1 flex-row items-center rounded-lg px-2 py-1.5 ${ja ? "bg-cardAlt" : ""}`}
                    >
                      <Ionicons
                        name={ja ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={ja ? C.primary : C.muted}
                      />
                      <View className="ml-2 flex-1">
                        {f.grupos.length > 1 ? <T className="font-mont-b text-[11px]">{g.grupo}</T> : null}
                        <T className="text-xs" numberOfLines={3}>
                          {g.opcoes.map((o) => `${o.descricao} ${fmtOdd(o.multiplicador)}`).join("  |  ")}
                        </T>
                      </View>
                    </Pressable>
                  );
                })
              : null}
          </View>
        );
      })}
    </View>
  );
}
