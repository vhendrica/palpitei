import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "../components/AppHeader";
import { ErrorBox, Field } from "../components/Form";
import { useDesktop } from "../lib/desktop";
import { Button, T } from "../components/ui";
import { errorMessage, useApp } from "../store/AppStore";
import { useTheme } from "../store/Theme";

export default function Entrar() {
  const { palette: C } = useTheme();
  const insets = useSafeAreaInsets();
  const { entrar } = useApp();
  const desktop = useDesktop();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErro(null);
    try {
      await entrar(email, senha);
      router.replace("/(tabs)");
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
          ...(desktop ? { width: "100%", maxWidth: 440, alignSelf: "center", paddingTop: 48 } : {}),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <T className="mb-6 font-mont-xb text-2xl">Bora palpitar?</T>
        <Field
          label="E-mail"
          icon="mail-outline"
          placeholder="voce@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label="Senha"
          icon="lock-closed-outline"
          placeholder="Sua senha"
          secureTextEntry={!mostrar}
          autoCapitalize="none"
          value={senha}
          onChangeText={setSenha}
          onSubmitEditing={submit}
          trailing={
            <Pressable onPress={() => setMostrar((m) => !m)} hitSlop={8}>
              <Ionicons
                name={mostrar ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={C.muted}
              />
            </Pressable>
          }
        />
        <ErrorBox erro={erro} />
        <Button
          title="Entrar"
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
