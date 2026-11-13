import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "../components/AppHeader";
import { Checkbox, ErrorBox, Field } from "../components/Form";
import { Button, T } from "../components/ui";
import { fmtCpf, fmtDataNasc, fmtWhats } from "../lib/format";
import { errorMessage, useApp } from "../store/AppStore";
import { useTheme } from "../store/Theme";

export default function Cadastro() {
  const { palette: C } = useTheme();
  const insets = useSafeAreaInsets();
  const { cadastrar } = useApp();
  const [nome, setNome] = useState("");
  const [whats, setWhats] = useState("");
  const [cpf, setCpf] = useState("");
  const [nasc, setNasc] = useState("");
  const [termos, setTermos] = useState(false);
  const [dados, setDados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErro(null);
    try {
      const r = await cadastrar({
        nome,
        whatsapp: whats,
        cpf,
        data_nascimento: nasc,
        aceita_termos: termos,
        aceita_compartilhamento: dados,
      });
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
              Ganhe 500 PONTOS ao confirmar sua conta.
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
          label="WhatsApp"
          icon="logo-whatsapp"
          placeholder="(85) 9 9999-9999"
          keyboardType="phone-pad"
          value={whats}
          onChangeText={(t) => setWhats(fmtWhats(t))}
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


        <Checkbox
          checked={termos}
          onChange={setTermos}
          label="Concordo com os Termos de Uso"
        />
        <Checkbox
          checked={dados}
          onChange={setDados}
          label="Concordo com o compartilhamento dos meus dados"
        />
        <T className="text-[11px] text-muted">Somente maiores de 18 anos.</T>

        <ErrorBox erro={erro} />
        <Button
          title="Receber código no WhatsApp"
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
