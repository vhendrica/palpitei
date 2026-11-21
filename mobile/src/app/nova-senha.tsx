import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { AppHeader } from "../components/AppHeader";
import { ErrorBox, Field } from "../components/Form";
import { Button, T } from "../components/ui";
import { api } from "../lib/api";
import { useDesktop } from "../lib/desktop";
import { errorMessage } from "../store/AppStore";

export default function NovaSenha() {
  const desktop = useDesktop();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [busy, setBusy] = useState(false);
  // O backend exige token > 20 chars — link sem token ou truncado já mostra
  // o erro aqui em vez de só falhar ao salvar.
  const linkInvalido = !token || token.length <= 20;

  const salvar = async () => {
    setBusy(true);
    setErro(null);
    try {
      if (senha !== senha2) throw new Error("As senhas não são iguais.");
      await api.redefinirSenha(String(token ?? ""), senha);
      setPronto(true);
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
      <AppHeader title="Senha nova" back />
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
        {linkInvalido ? (
          <>
            <T className="mb-2 font-mont-xb text-2xl">
              Link inválido ou expirado
            </T>
            <T className="mb-6 text-sm text-muted">
              Esse link de recuperação já foi usado ou expirou. Peça um novo.
            </T>
            <Button
              title="Pedir novo link"
              onPress={() => router.replace("/esqueci" as never)}
            />
          </>
        ) : pronto ? (
          <>
            <T className="mb-2 font-mont-xb text-2xl">Senha trocada!</T>
            <T className="mb-6 text-sm text-muted">
              Agora é só entrar com a senha nova.
            </T>
            <Button title="Entrar" onPress={() => router.replace("/entrar")} />
          </>
        ) : (
          <>
            <T className="mb-6 font-mont-xb text-2xl">Crie sua senha nova</T>
            <Field
              label="Senha nova"
              icon="lock-closed-outline"
              placeholder="Mín. 8, com letras e números"
              secureTextEntry
              autoCapitalize="none"
              value={senha}
              onChangeText={setSenha}
            />
            <Field
              label="Repita a senha"
              icon="lock-closed-outline"
              placeholder="Confirme sua senha"
              secureTextEntry
              autoCapitalize="none"
              value={senha2}
              onChangeText={setSenha2}
              onSubmitEditing={salvar}
            />
            <ErrorBox erro={erro} />
            <Button
              title="Salvar senha"
              onPress={salvar}
              loading={busy}
              disabled={!senha || !senha2}
              className="mt-6"
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
