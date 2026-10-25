import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Logo } from "../components/Logo";
import { Button, T } from "../components/ui";
import { BAIRROS_FORTALEZA, SALDO_INICIAL_PONTOS } from "../lib/constants";
import { fmtWhats } from "../lib/format";
import { errorMessage, useApp } from "../store/AppStore";
import { useTheme } from "../store/Theme";

function Field({
  label,
  icon,
  ...props
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
} & React.ComponentProps<typeof TextInput>) {
  const { palette: C } = useTheme();
  return (
    <View className="mb-4">
      <T className="mb-1.5 font-mont-b text-xs uppercase tracking-widest text-muted">
        {label}
      </T>
      <View className="flex-row items-center rounded-xl border border-line bg-card px-3">
        <Ionicons name={icon} size={18} color={C.muted} />
        <TextInput
          placeholderTextColor={C.muted}
          className="ml-2 flex-1 py-3.5 font-mont-sb text-base text-fg"
          {...props}
        />
      </View>
    </View>
  );
}

export default function Onboarding() {
  const { palette: C } = useTheme();
  const { onboard } = useApp();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [whats, setWhats] = useState("");
  const [bairro, setBairro] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const submit = () => {
    try {
      setErro(null);
      onboard({ name, whatsapp: whats, bairro });
    } catch (e) {
      setErro(errorMessage(e));
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{ paddingTop: insets.top + 28 }}
          className="bg-header px-5 pb-8"
        >
          <Logo size="lg" />
          <T className="mt-6 font-mont-xb text-3xl leading-9 text-onHeader">
            A emoção da BET{"\n"}
            <T className="font-mont-xb text-3xl text-headerAccent">
              sem o risco da BET
            </T>
          </T>
          <T className="mt-3 text-sm leading-5 text-onHeader/80">
            Jogue sem risco e transforme seu palpite em prêmios reais
          </T>
        </View>

        <View className="px-5">
          <View className="mt-6 flex-row items-center rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <Ionicons name="gift" size={26} color={C.primary} />
            <View className="ml-3 flex-1">
              <T className="font-mont-b text-sm">Bônus de boas-vindas</T>
              <T className="text-xs text-fg/70">
                Ganhe {SALDO_INICIAL_PONTOS} PONTOS ao criar sua conta.
              </T>
            </View>
            <T className="font-odds text-2xl text-primary">
              +{SALDO_INICIAL_PONTOS}
            </T>
          </View>

          <View className="mt-8">
            <Field
              label="Seu nome"
              icon="person-outline"
              placeholder="Como te chamam?"
              value={name}
              onChangeText={setName}
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
            <T className="mb-2 font-mont-b text-xs uppercase tracking-widest text-muted">
              Seu bairro
            </T>
            <View className="flex-row flex-wrap">
              {BAIRROS_FORTALEZA.map((b) => {
                const sel = b === bairro;
                return (
                  <Pressable
                    key={b}
                    onPress={() => setBairro(b)}
                    className={`mb-2 mr-2 rounded-full border px-3.5 py-2 ${sel ? "border-primary bg-primary" : "border-line bg-card"}`}
                  >
                    <T
                      className={`font-mont-sb text-xs ${sel ? "text-onPrimary" : "text-fg"}`}
                    >
                      {b}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {erro ? (
            <View className="mt-4 flex-row items-center rounded-lg bg-danger/15 p-3">
              <Ionicons name="alert-circle" size={18} color={C.danger} />
              <T className="ml-2 flex-1 font-mont-sb text-sm text-danger">
                {erro}
              </T>
            </View>
          ) : null}

          <Button
            title={`Criar conta e ganhar ${SALDO_INICIAL_PONTOS} pontos`}
            onPress={submit}
            className="mt-6"
          />
          <T className="mt-3 text-center text-[11px] text-muted">
            Jogo recreativo. PONTOS e FICHAS não têm valor em dinheiro.
          </T>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
