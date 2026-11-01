import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { AppHeader } from "../components/AppHeader";
import { ErrorBox, Field } from "../components/Form";
import { Button, T } from "../components/ui";
import { errorMessage, useApp } from "../store/AppStore";

export default function Codigo() {
  const params = useLocalSearchParams<{
    whatsapp: string;
    destino: string;
    dev?: string;
  }>();
  const { confirmarCodigo, reenviarCodigo } = useApp();
  const [codigo, setCodigo] = useState("");
  const [dev, setDev] = useState(params.dev || "");
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmar = async () => {
    setBusy(true);
    setErro(null);
    try {
      await confirmarCodigo(params.whatsapp, codigo);
      router.dismissAll();
      router.replace("/");
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reenviar = async () => {
    setErro(null);
    try {
      const r = await reenviarCodigo(params.whatsapp);
      setDev(r.dev_codigo ?? "");
      setInfo("Código reenviado.");
    } catch (e) {
      setErro(errorMessage(e));
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppHeader title="Código" back />
      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <T className="mb-2 font-mont-xb text-2xl">Confira seu WhatsApp</T>
        <T className="mb-6 text-sm text-muted">
          Mandamos um código de 6 dígitos para {params.destino}. Ele vale por 10
          minutos.
        </T>
        <Field
          label="Código"
          icon="key-outline"
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          value={codigo}
          onChangeText={(t) => setCodigo(t.replace(/\D/g, ""))}
        />
        {dev ? (
          <T className="text-xs text-muted">Modo dev: código {dev}</T>
        ) : null}
        <ErrorBox erro={erro} />
        {info ? <T className="mt-3 text-sm text-primary">{info}</T> : null}
        <Button
          title="Confirmar"
          onPress={confirmar}
          loading={busy}
          disabled={codigo.length !== 6}
          className="mt-6"
        />
        <Button
          title="Reenviar código"
          variant="ghost"
          onPress={reenviar}
          className="mt-3"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
