import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import { AppHeader } from "../../../components/AppHeader";
import { ErrorBox } from "../../../components/Form";
import { Button, Card, Esqueleto, StatusBadge, T } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useDesktop } from "../../../lib/desktop";
import { fmtData } from "../../../lib/format";
import { guardarRetorno } from "../../../lib/retorno";
import { errorMessage, useApp } from "../../../store/AppStore";
import type { DesafioResumo } from "../../../types";

/** Link de convite: mostra o desafio e o botão de entrar. */
export default function Convite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user } = useApp();
  const [d, setD] = useState<DesafioResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const desktop = useDesktop();

  useEffect(() => {
    (async () => {
      try {
        const r = await api.desafios.convite(String(token));
        setD(r.desafio);
      } catch (e) {
        setErro(errorMessage(e));
      }
    })();
  }, [token]);

  const entrar = useCallback(async () => {
    if (!d) return;
    setEntrando(true);
    try {
      await api.desafios.entrar(d.id);
      router.replace(`/desafio/${d.id}`);
    } catch (e) {
      setErro(errorMessage(e));
      setEntrando(false);
    }
  }, [d]);

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Convite" back />
      <ScrollView
        contentContainerStyle={[{ padding: 16 }, desktop ? { maxWidth: 520, width: "100%", alignSelf: "center" } : null]}
      >
        <ErrorBox erro={erro} />
        {!d && !erro ? <Esqueleto blocos={1} /> : null}
        {d ? (
          <Card>
            <T className="font-mont-xb text-lg">{d.titulo ?? `Desafio de ${d.dono}`}</T>
            <T className="mt-1 text-sm text-muted">
              {d.dono} te chamou pra um desafio no PALPIT
            </T>
            <View className="mt-3 flex-row items-center">
              <StatusBadge status={d.status} />
              <T className="ml-3 text-xs text-muted">
                {d.jogos} {d.jogos === 1 ? "jogo" : "jogos"} · {d.palpiteiros}{" "}
                {d.palpiteiros === 1 ? "palpiteiro" : "palpiteiros"} · {fmtData(d.data)}
              </T>
            </View>
            <T className="mt-3 text-xs text-muted">
              Entrada grátis: você ganha {d.fichas_por_entrada} fichas pra distribuir.
            </T>
            {d.status === "finalizada" ? (
              <Button
                title="Ver resultado"
                variant="outline"
                className="mt-4"
                onPress={() => router.replace(`/desafio/${d.id}`)}
              />
            ) : user ? (
              <Button title="Entrar no desafio" className="mt-4" onPress={entrar} loading={entrando} />
            ) : (
              <Button
                title="Entre na sua conta pra participar"
                className="mt-4"
                onPress={() => {
                  guardarRetorno(`/desafio/convite?token=${token}`);
                  router.push("/entrar");
                }}
              />
            )}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}