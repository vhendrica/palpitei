import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "../components/AppHeader";
import { ErrorBox, Field } from "../components/Form";
import { Button, T } from "../components/ui";
import { fmtWhats } from "../lib/format";
import { errorMessage, useApp } from "../store/AppStore";

export default function Entrar() {
  const insets = useSafeAreaInsets();
  const { pedirCodigo } = useApp();
  const [whats, setWhats] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErro(null);
    try {
      const r = await pedirCodigo(whats);
      router.push({
        pathname: "/codigo",
        params: {
          whatsapp: r.whatsapp,
          destino: r.destino,
          dev: r.dev_codigo ?? "",
        },
      });
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppHeader title="Entrar" back />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <T className="mb-6 font-mont-xb text-2xl">Bora palpitar?</T>
        <Field
          label="WhatsApp"
          icon="logo-whatsapp"
          placeholder="(85) 9 9999-9999"
          keyboardType="phone-pad"
          value={whats}
          onChangeText={(t) => setWhats(fmtWhats(t))}
        />
        <T className="text-xs text-muted">
          Vamos te mandar um código de 6 dígitos no WhatsApp.
        </T>
        <ErrorBox erro={erro} />
        <Button
          title="Receber código"
          onPress={submit}
          loading={busy}
          className="mt-6"
        />
        <View className="mt-8 items-center">
          <T className="text-sm text-muted">Ainda não tem conta?</T>
          <Button
            title="Criar conta"
            variant="outline"
            onPress={() => router.push("/cadastro")}
            className="mt-2 self-stretch"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
