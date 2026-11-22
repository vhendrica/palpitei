import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { api } from "../lib/api";
import { track } from "../lib/analytics";
import { useDesktop } from "../lib/desktop";
import { fmtCpf, fmtDataNasc, fmtWhats } from "../lib/format";
import { errorMessage, useApp } from "../store/AppStore";
import { useTheme } from "../store/Theme";

const USERNAME_OK = /^[a-z0-9][a-z0-9._-]{2,19}$/;

// No computador o formulário fica centralizado e os campos andam em pares.
function Linha({
  desktop,
  children,
}: {
  desktop: boolean;
  children: React.ReactNode;
}) {
  if (!desktop) return <>{children}</>;
  const filhos = Array.isArray(children) ? children : [children];
  return (
    <View className="flex-row" style={{ gap: 16 }}>
      {filhos.map((ch, i) => (
        <View key={i} className="flex-1">
          {ch}
        </View>
      ))}
    </View>
  );
}

export default function Cadastro() {
  const { palette: C } = useTheme();
  const insets = useSafeAreaInsets();
  const { cadastrar } = useApp();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const indicadoPor = typeof ref === "string" ? ref.trim().toLowerCase() : "";
  const desktop = useDesktop();
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  // Último username checado + resultado ('verificando' enquanto a API responde).
  const [userCheck, setUserCheck] = useState<{ u: string; status: "verificando" | boolean | null } | null>(null);
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
  // Cadastro em 2 passos: conta primeiro, dados legais depois.
  const [passo, setPasso] = useState(1);

  const olho = (
    <Pressable onPress={() => setMostrar((m) => !m)} hitSlop={8}>
      <Ionicons
        name={mostrar ? "eye-off-outline" : "eye-outline"}
        size={20}
        color={C.muted}
      />
    </Pressable>
  );

  const userAtual = username.trim().toLowerCase();
  const userStatus = !USERNAME_OK.test(userAtual)
    ? null
    : userCheck?.u === userAtual
      ? userCheck.status
      : "verificando";

  // Debounce da checagem de username: dispara 400ms depois de parar de digitar.
  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!USERNAME_OK.test(u)) return;
    const t = setTimeout(() => {
      setUserCheck({ u, status: "verificando" });
      api.usernameLivre(u).then(
        (r) => setUserCheck((s) => (s?.u === u ? { u, status: r.disponivel } : s)),
        () => setUserCheck((s) => (s?.u === u ? { u, status: null } : s)),
      );
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const avancar = () => {
    setErro(null);
    if (nome.trim().length < 2) return setErro("Conta seu nome completo.");
    if (!USERNAME_OK.test(username.trim().toLowerCase()))
      return setErro("Nome de usuário: 3 a 20 caracteres (letras, números, ponto, hífen ou _).");
    if (userStatus === false) return setErro("Esse nome de usuário já está em uso.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErro("Confere o e-mail.");
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(senha))
      return setErro("A senha precisa de 8+ caracteres, com letras e números.");
    if (senha !== senha2) return setErro("As senhas não são iguais.");
    setPasso(2);
  };

  const submit = async () => {
    setBusy(true);
    setErro(null);
    try {
      if (senha !== senha2) throw new Error("As senhas não são iguais.");
      await cadastrar({
        nome,
        username: username.trim().toLowerCase(),
        email,
        senha,
        whatsapp: whats,
        cpf,
        data_nascimento: nasc,
        aceita_termos: termos,
        aceita_compartilhamento: dados,
        ...(indicadoPor ? { indicado_por: indicadoPor } : {}),
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
          ...(desktop
            ? {
                width: "100%",
                maxWidth: 640,
                alignSelf: "center",
                paddingTop: 32,
              }
            : {}),
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

        <View className="mb-4 flex-row items-center">
          <View
            className={`h-1.5 flex-1 rounded-full ${passo >= 1 ? "bg-primary" : "bg-cardAlt"}`}
          />
          <View className="w-2" />
          <View
            className={`h-1.5 flex-1 rounded-full ${passo >= 2 ? "bg-primary" : "bg-cardAlt"}`}
          />
        </View>
        <T className="mb-4 text-center text-xs text-muted">
          Passo {passo} de 2 · {passo === 1 ? "Sua conta" : "Seus dados"}
        </T>

        {passo === 1 ? (
          <>
        <Linha desktop={desktop}>
          <Field
            label="Nome completo"
            icon="person-outline"
            placeholder="Seu nome e sobrenome"
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
          />
          <Field
            label="Nome de usuário"
            icon="at-outline"
            placeholder="aparece no ranking"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ""))}
            trailing={
              userStatus === "verificando" ? (
                <ActivityIndicator size="small" color={C.muted} />
              ) : userStatus === true ? (
                <Ionicons name="checkmark-circle" size={18} color={C.primary} />
              ) : userStatus === false ? (
                <Ionicons name="close-circle" size={18} color={C.danger} />
              ) : null
            }
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
        </Linha>
        <Linha desktop={desktop}>
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
        </Linha>
          </>
        ) : (
          <>
        <Linha desktop={desktop}>
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
        </Linha>
        <Field
          label="WhatsApp"
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
          </>
        )}

        <ErrorBox erro={erro} />
        {passo === 1 ? (
          <Button title="Continuar" onPress={avancar} className="mt-6" />
        ) : (
          <>
            <Button
              title="Voltar"
              variant="ghost"
              icon="chevron-back"
              onPress={() => {
                setErro(null);
                setPasso(1);
              }}
              className="mt-6"
            />
            <Button
              title="Criar conta"
              onPress={submit}
              loading={busy}
              disabled={!termos || !dados}
              className="mt-3"
            />
          </>
        )}
        <T className="mt-3 text-center text-[11px] text-muted">
          Jogo recreativo. PONTOS e FICHAS não têm valor em dinheiro.
        </T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
