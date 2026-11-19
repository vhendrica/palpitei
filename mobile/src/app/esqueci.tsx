import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { AppHeader } from "../components/AppHeader";
import { ErrorBox, Field } from "../components/Form";
import { Button, T } from "../components/ui";
import { api } from "../lib/api";
import { useDesktop } from "../lib/desktop";
import { errorMessage } from "../store/AppStore";

export default function Esqueci() {
  const desktop = useDesktop();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enviar = async () => {
    setBusy(true);
    setErro(null);
    try {
      setEnviado((await api.esqueciSenha(email)).mensagem);
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
      <AppHeader title="Recuperar senha" back />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          ...(desktop
            ? {
                width: "100%",
                maxWidth: 440,
                alignSelf: "center",
                paddingTop: 48,
              }
            : {}),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <T className="mb-2 font-mont-xb text-2xl">Esqueceu a senha?</T>
        <T className="mb-6 text-sm text-muted">
          Digite o e-mail da sua conta. Vamos mandar um link pra você criar uma
          senha nova.
        </T>
        <Field
          label="E-mail"
          icon="mail-outline"
          placeholder="voce@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={enviar}
        />
        <ErrorBox erro={erro} />
        {enviado ? (
          <T className="mt-3 text-sm text-primary">{enviado}</T>
        ) : null}
        <Button
          title="Enviar link"
          onPress={enviar}
          loading={busy}
          disabled={!email}
          className="mt-6"
        />
        <Button
          title="Voltar pro login"
          variant="ghost"
          onPress={() => router.back()}
          className="mt-3"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
