import { router } from "expo-router";
import { ScrollView, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { useEntrarLiga } from "../../components/EntrarLiga";
import { LigaCard } from "../../components/LigaCard";
import { Button, EmptyState, SectionTitle } from "../../components/ui";
import { fichasDisponiveis, getEntrada } from "../../lib/rules";
import { useApp } from "../../store/AppStore";
import type { Liga } from "../../types";

export default function Ligas() {
  const { db, user } = useApp();
  const { abrir, modal } = useEntrarLiga();
  if (!user) return null;

  const ativas = db.ligas.filter((l) => l.status !== "finalizada");
  const encerradas = db.ligas.filter((l) => l.status === "finalizada");
  const participantes = (id: string) =>
    db.entradas.filter((e) => e.liga_id === id).length;
  const ver = (id: string) =>
    router.push({ pathname: "/liga/[id]", params: { id } });

  const footer = (l: Liga) => {
    const entrou = !!getEntrada(db, user.id, l.id);
    if (entrou) {
      const livres = fichasDisponiveis(db, user.id, l.id);
      const label =
        l.status === "aberta" && livres > 0
          ? `Distribuir fichas (${livres} livres)`
          : "Ver meu palpite";
      return (
        <Button
          title={label}
          variant="outline"
          icon="arrow-forward"
          onPress={() => ver(l.id)}
        />
      );
    }
    if (l.status === "aberta")
      return (
        <Button
          title={`Entrar por ${l.custo_entrada} PONTOS`}
          onPress={() => abrir(l)}
        />
      );
    if (l.status === "em_andamento")
      return (
        <Button
          title="Jogo em andamento • ver mercados"
          variant="ghost"
          onPress={() => ver(l.id)}
        />
      );
    return (
      <Button
        title="Ver resultado"
        variant="ghost"
        icon="podium"
        onPress={() => ver(l.id)}
      />
    );
  };

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Palpites" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <SectionTitle>Palpites ativos</SectionTitle>
        {ativas.length === 0 ? (
          <EmptyState
            icon="football-outline"
            title="Nenhum palpite ativo agora"
            subtitle="Volte mais tarde!"
          />
        ) : (
          ativas.map((l) => (
            <LigaCard
              key={l.id}
              liga={l}
              participantes={participantes(l.id)}
              footer={footer(l)}
            />
          ))
        )}
        {encerradas.length > 0 ? (
          <>
            <SectionTitle>Encerradas</SectionTitle>
            {encerradas.map((l) => (
              <LigaCard
                key={l.id}
                liga={l}
                participantes={participantes(l.id)}
                footer={footer(l)}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
      {modal}
    </View>
  );
}
