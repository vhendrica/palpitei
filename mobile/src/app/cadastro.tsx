import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "../components/AppHeader";
import { Checkbox, ErrorBox, Field } from "../components/Form";
import { Button, T } from "../components/ui";
import { track } from "../lib/analytics";
import { fmtCpf, fmtDataNasc, fmtWhats } from "../lib/format";
import { errorMessage, useApp } from "../store/AppStore";
import { useTheme } from "../store/Theme";

export default function Cadastro() {
  const { palette: C } = useTheme();
  const insets = useSafeAreaInsets();
  const { cadastrar } = useApp();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [whats, setWhats] = useState("");
  const [cpf, setCpf] = useState("");
  const [nasc, setNasc] = useState("");
  const [termos, setTermos] = useState(false);
  const [dados, setDados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const olho = (
    <Pressable onPress={() => setMostrar((m) => !m)} hitSlop={8}>
      <Ionicons name={mostrar ? "eye-off-outline" : "eye-outline"} size={20} color={C.muted} />
    </Pressable>
  );

  const submit = async () => {
    setBusy(true);
    setErro(null);
    try {
      if (senha !== senha2) throw new Error("As senhas não são iguais.");
      await cadastrar({
        nome,
        email,
        senha,
        whatsapp: whats || undefined,
        cpf,
        data_nascimento: nasc,
        aceita_termos: termos,
        aceita_compartilhamento: dados,
      });
      track("Preencheu cadastro");
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
      <AppHeader title="Criar conta" back />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 flex-row items-center rounded-2xl border border-primary/30 bg-primary/10 p-4">
          <Ionicons name="gift" size={26} color={C.primary} />
          <View className="ml-3 flex-1">
            <T className="font-mont-b text-sm">Bônus de boas-vindas</T>
            <T className="text-xs text-fg/70">
              Ganhe 500 PONTOS ao criar sua conta.
            </T>
          </View>
          <T className="font-odds text-2xl text-primary">+500</T>
        </View>

        <Field
          label="Seu nome"
          icon="person-outline"
          placeholder="Como te chamam?"
          value={nome}
          onChangeText={setNome}
          autoCapitalize="words"
        />
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
          placeholder="Mín. 8, com letras e números"
          secureTextEntry={!mostrar}
          autoCapitalize="none"
          value={senha}
          onChangeText={setSenha}
          trailing={olho}
        />
        <Field
          label="Repita a senha"
          icon="lock-closed-outline"
          placeholder="Confirme sua senha"
          secureTextEntry={!mostrar}
          autoCapitalize="none"
          value={senha2}
          onChangeText={setSenha2}
          trailing={olho}
        />
        <Field
          label="CPF"
          icon="card-outline"
          placeholder="000.000.000-00"
          keyboardType="number-pad"
          value={cpf}
          onChangeText={(t) => setCpf(fmtCpf(t))}
        />
        <Field
          label="Data de nascimento"
          icon="calendar-outline"
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          value={nasc}
          onChangeText={(t) => setNasc(fmtDataNasc(t))}
        />
        <Field
          label="WhatsApp (opcional)"
          icon="logo-whatsapp"
          placeholder="(85) 9 9999-9999"
          keyboardType="phone-pad"
          value={whats}
          onChangeText={(t) => setWhats(fmtWhats(t))}
        />

        <Checkbox
          checked={termos}
          onChange={setTermos}
          label="Concordo com os Termos de Uso e a Política de Privacidade"
        />
        <Checkbox
          checked={dados}
          onChange={setDados}
          label="Autorizo a coleta e o uso dos meus dados conforme a política"
        />
        <T className="text-[11px] text-muted">Somente maiores de 18 anos.</T>

        <ErrorBox erro={erro} />
        <Button
          title="Criar conta"
          onPress={submit}
          loading={busy}
          disabled={!termos || !dados}
          className="mt-6"
        />
        <T className="mt-3 text-center text-[11px] text-muted">
          Jogo recreativo. PONTOS e FICHAS não têm valor em dinheiro.
        </T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
