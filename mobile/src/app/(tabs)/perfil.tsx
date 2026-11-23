import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { type ComponentProps, useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, Switch, View } from "react-native";

import { AppHeader } from "../../components/AppHeader";
import { AuthGate } from "../../components/AuthGate";
import { DOCUMENTOS } from "../../components/Documento";
import { ErrorBox, Field } from "../../components/Form";
import { fmtReais } from "../../components/PremioBar";
import { useToast } from "../../components/Toast";
import { Button, Card, Esqueleto, T } from "../../components/ui";
import { api } from "../../lib/api";
import { compartilhar, copiar, enviarWhatsApp, linkIndicacao, mensagemConvite } from "../../lib/convite";
import { useDesktop } from "../../lib/desktop";
import { fmtOdd, fmtPts, fmtWhats } from "../../lib/format";
import { errorMessage, useApp } from "../../store/AppStore";
import { ThemeVars, useTheme } from "../../store/Theme";
import type { Perfil as PerfilT } from "../../types";

const fmtDia = (d: string) => d.split("-").reverse().join("/");

const Titulo = ({ children }: { children: string }) => (
  <T className="mb-2 mt-5 font-mont-xb text-[11px] uppercase tracking-widest text-muted">{children}</T>
);

function Numero({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return (
    <View className="flex-1 rounded-xl border border-line bg-card px-2.5 py-3">
      <T className={`font-odds text-xl ${cor ?? ""}`}>{valor}</T>
      <T className="mt-0.5 text-[10px] leading-[13px] text-muted">{rotulo}</T>
    </View>
  );
}

/** Linha de seção: ícone + título + ">"; expande o conteúdo ou navega. */
function Secao({
  icone,
  titulo,
  aberto,
  onPress,
}: {
  icone: ComponentProps<typeof Ionicons>["name"];
  titulo: string;
  aberto?: boolean;
  onPress: () => void;
}) {
  const { palette: C } = useTheme();
  return (
    <Pressable onPress={onPress} className="mt-3">
      <Card className="flex-row items-center py-3">
        <Ionicons name={icone} size={20} color={C.primary} />
        <T className="ml-3 flex-1 font-mont-b text-sm">{titulo}</T>
        <Ionicons name={aberto ? "chevron-up" : "chevron-forward"} size={18} color={C.muted} />
      </Card>
    </Pressable>
  );
}

export default function Perfil() {
  const { palette: C, noturno, setNoturno } = useTheme();
  const { user, sair, refreshUser } = useApp();
  const [perfil, setPerfil] = useState<PerfilT | null>(null);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [bairro, setBairro] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState<"numeros" | "convite" | null>(null);
  const toast = useToast();
  const desktop = useDesktop();

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      refreshUser();
      api
        .me()
        .then(setPerfil)
        .catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]),
  );

  const tema = (
    <Card className="mt-3 flex-row items-center justify-between">
      <View className="flex-row items-center">
        <Ionicons name="moon" size={18} color={C.fg} />
        <T className="ml-2 font-mont-b text-sm">Modo noturno</T>
      </View>
      <Switch value={noturno} onValueChange={setNoturno} />
    </Card>
  );

  const documentos = (
    <>
      <Titulo>Regras e documentos</Titulo>
      <Card className="py-1">
        {DOCUMENTOS.map((d, i) => (
          <Pressable
            key={d.label}
            onPress={() => router.push(d.href)}
            accessibilityRole="link"
            className={`flex-row items-center py-3 ${i > 0 ? "border-t border-line" : ""}`}
          >
            <Ionicons name="document-text-outline" size={18} color={C.muted} />
            <T className="ml-3 flex-1 font-mont-b text-sm">{d.label}</T>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
        ))}
      </Card>
    </>
  );

  if (!user) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Perfil" />
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <AuthGate
            title="Entre pra ver seu saldo"
            subtitle="Crie sua conta e ganhe PONTOS de boas-vindas."
          />
          {tema}
          {documentos}
        </ScrollView>
      </View>
    );
  }

  const abrirEdicao = () => {
    setNome(user.nome);
    setBairro(user.bairro ?? "");
    setErro(null);
    setEditando(true);
  };
  const salvar = async () => {
    setSalvando(true);
    try {
      await api.atualizarPerfil({ nome, bairro });
      await refreshUser();
      setEditando(false);
    } catch (e) {
      setErro(errorMessage(e));
    }
    setSalvando(false);
  };

  const s = perfil?.stats;
  const streak = user.login_streak ?? 0;
  const recorde = Math.max(user.maior_streak ?? 0, streak);

  const identidade = (
    <Card className="flex-row items-center">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-primary">
        <T className="font-mont-xb text-2xl text-onPrimary">{user.nome[0]?.toUpperCase()}</T>
      </View>
      <View className="ml-3 flex-1">
        <T className="font-mont-xb text-lg" numberOfLines={1}>
          {user.nome}
        </T>
        <T className="text-xs text-muted" numberOfLines={1}>
          {user.email ?? (user.whatsapp ? fmtWhats(user.whatsapp) : "")}
          {user.bairro ? ` · ${user.bairro}` : ""}
        </T>
      </View>
      <Pressable onPress={abrirEdicao} className="rounded-lg border border-line px-2.5 py-1.5">
        <T className="font-mont-b text-[11px] text-muted">Editar</T>
      </Pressable>
    </Card>
  );

  const saldo = (
    <View className="mt-3 flex-row items-end justify-between rounded-2xl border border-primary/40 bg-primary/10 p-4">
      <View>
        <T className="text-[10px] uppercase tracking-widest text-primary">Saldo do perfil</T>
        <View className="mt-1 flex-row items-end">
          <T className="font-odds text-4xl text-primary">{fmtPts(user.saldo_pontos)}</T>
          <T className="mb-1.5 ml-1.5 font-mont-b text-xs text-primary">PONTOS</T>
        </View>
      </View>
      <View className="items-end">
        <T className="font-odds text-xl">
          {streak} {streak === 1 ? "dia" : "dias"}
        </T>
        <T className="text-[10px] text-muted">sequência · recorde {recorde}</T>
        <View className="mt-1.5 flex-row">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <View key={d} className={`ml-1 h-1 w-3.5 rounded-full ${d <= streak ? "bg-primary" : "bg-line"}`} />
          ))}
        </View>
      </View>
    </View>
  );

  const numeros = s
    ? [
        <Numero key="p" valor={fmtPts(s.participacoes)} rotulo="rodadas e desafios" />,
        <Numero key="v" valor={fmtPts(s.vitorias)} rotulo={desktop ? "vitórias" : "vitórias (1º lugar)"} cor="text-gold" />,
        <Numero key="d" valor={fmtPts(s.podios)} rotulo={desktop ? "pódios" : "pódios (top 3)"} />,
        <Numero key="o" valor={s.maior_odd ? fmtOdd(s.maior_odd) : "—"} rotulo="maior odd acertada" cor="text-primary" />,
        <Numero key="r" valor={fmtPts(s.recorde_pontos)} rotulo="recorde na rodada do dia" cor="text-primary" />,
        <Numero key="t" valor={s.taxa_acerto == null ? "—" : `${s.taxa_acerto}%`} rotulo="palpites certos" />,
      ]
    : [];
  const duelos = s ? s.duelos_vitorias + s.duelos_derrotas : 0;

  const meusNumeros = (
    <>
      <Secao
        icone="stats-chart-outline"
        titulo="Meus números"
        aberto={aberto === "numeros"}
        onPress={() => setAberto((a) => (a === "numeros" ? null : "numeros"))}
      />
      {aberto === "numeros" ? (
        !s ? (
          <View className="mt-2"><Esqueleto blocos={2} /></View>
        ) : (
          <>
            {desktop ? (
              <View className="mt-2 flex-row gap-2">{numeros}</View>
            ) : (
              <>
                <View className="mt-2 flex-row gap-2">{numeros.slice(0, 3)}</View>
                <View className="mt-2 flex-row gap-2">{numeros.slice(3)}</View>
              </>
            )}
      <Card className="mt-2 flex-row items-center py-3">
        <T className="font-mont-b text-sm">Duelos</T>
        {duelos > 0 ? (
          <>
            <T className="ml-3 font-odds text-sm text-primary">{s.duelos_vitorias}V</T>
            <View className="mx-2.5 h-1.5 flex-1 flex-row overflow-hidden rounded-full bg-danger">
              <View className="bg-primary" style={{ flex: s.duelos_vitorias }} />
              <View style={{ flex: s.duelos_derrotas }} />
            </View>
            <T className="font-odds text-sm text-danger">{s.duelos_derrotas}D</T>
          </>
        ) : (
          <T className="ml-3 flex-1 text-xs text-muted">Nenhum duelo encerrado ainda.</T>
        )}
      </Card>
          </>
        )
      ) : null}
    </>
  );

  // "Histórico >" abre a tela completa em vez de ocupar o perfil com a lista.
  const historico = (
    <Secao icone="time-outline" titulo="Histórico" onPress={() => router.push("/historico")} />
  );

  const vouchers = (
    <>
      <Titulo>Vouchers</Titulo>
      {perfil?.vouchers.length ? (
        perfil.vouchers.map((v) => (
          <Card key={v.codigo} className="mb-2 flex-row items-center justify-between">
            <View className="flex-1">
              <T className="font-odds text-sm">{v.codigo}</T>
              <T className="text-[11px] text-muted">
                Rodada de {fmtDia(v.data)} · {v.resgatado ? "resgatado" : "não resgatado"}
              </T>
            </View>
            <T className={`font-odds text-base ${v.resgatado ? "text-muted" : "text-gold"}`}>{fmtReais(v.valor)}</T>
          </Card>
        ))
      ) : (
        <T className="text-sm text-muted">Nenhum voucher ainda.</T>
      )}
    </>
  );

  // Programa de indicação: botões à mostra; a regra fica atrás do ">".
  const convite = user?.username ? (
    <Card className="mt-3">
      <Pressable
        className="flex-row items-center"
        onPress={() => setAberto((a) => (a === "convite" ? null : "convite"))}
      >
        <Ionicons name="people" size={20} color={C.primary} />
        <T className="ml-2 flex-1 font-mont-b text-sm">Convide amigos e ganhe até 500 pts</T>
        <Ionicons name={aberto === "convite" ? "chevron-up" : "chevron-forward"} size={18} color={C.muted} />
      </Pressable>
      {aberto === "convite" ? (
        <T className="mt-2 text-xs leading-[18px] text-muted">
          {`Cada amigo que entrar pelo seu link rende pontos pra você:\n\n+ 50 pts quando ele se cadastrar\n+ 50 pts se ele palpitar no mesmo dia\n+ 100 pts a cada dia que ele voltar nos 3 dias seguintes\n+ 100 pts de bônus se ele completar os 3 logins seguidos`}
        </T>
      ) : null}
      <View className="mt-3 flex-row" style={{ gap: 8 }}>
        <Button
          title="WhatsApp"
          icon="logo-whatsapp"
          className="flex-1"
          onPress={() => enviarWhatsApp(mensagemConvite(linkIndicacao(user.username)))}
        />
        <Button
          title="Copiar"
          icon="copy-outline"
          variant="outline"
          className="flex-1"
          onPress={async () => {
            const ok = await copiar(mensagemConvite(linkIndicacao(user.username)));
            if (!ok) {
              await compartilhar(mensagemConvite(linkIndicacao(user.username)));
              return;
            }
            toast.show("Mensagem copiada!");
          }}
        />
      </View>
    </Card>
  ) : null;

  const sairBtn = <Button title="Sair" variant="danger" onPress={sair} className="mt-4" />;

  // Admin vive dentro do Perfil: a barra de baixo fica em 5 abas.
  const adminLink = user.is_admin ? (
    <>
      <Titulo>Administração</Titulo>
      <Pressable onPress={() => router.push("/admin")}>
        <Card className="flex-row items-center py-3">
          <Ionicons name="construct-outline" size={20} color={C.primary} />
          <View className="ml-3 flex-1">
            <T className="font-mont-b text-sm">Painel admin</T>
            <T className="text-[11px] text-muted">
              Rodadas, jogos, importações e configuração.
            </T>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </Card>
      </Pressable>
    </>
  ) : null;

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Perfil" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {desktop ? (
          <View style={{ maxWidth: 1040, width: "100%", alignSelf: "center", flexDirection: "row", gap: 20 }}>
            <View style={{ width: 320 }}>
              {identidade}
              {saldo}
              {convite}
              {vouchers}
              {adminLink}
              {tema}
              {documentos}
              {sairBtn}
            </View>
            <View style={{ flex: 1, marginTop: perfil ? -20 : 0 }}>
              {perfil ? null : <Esqueleto />}
              {meusNumeros}
              {perfil ? historico : null}
            </View>
          </View>
        ) : (
          <View>
            {identidade}
            {saldo}
            {convite}
            {perfil ? null : <View className="mt-4"><Esqueleto blocos={2} /></View>}
            {meusNumeros}
            {perfil ? historico : null}
            {perfil ? vouchers : null}
            {adminLink}
            {tema}
            {documentos}
            {sairBtn}
          </View>
        )}
      </ScrollView>
      {toast.node}

      <Modal visible={editando} transparent animationType="fade" onRequestClose={() => setEditando(false)}>
        <ThemeVars>
          <View className="flex-1 items-center justify-center bg-black/60 px-5">
            <View className="w-full max-w-[420px] rounded-2xl bg-card p-5">
              <T className="mb-4 font-mont-xb text-lg">Editar perfil</T>
              <Field label="Nome" value={nome} onChangeText={setNome} autoCapitalize="words" maxLength={120} />
              <Field label="Bairro" value={bairro} onChangeText={setBairro} autoCapitalize="words" maxLength={80} />
              <ErrorBox erro={erro} />
              <Button title="Salvar" onPress={salvar} loading={salvando} disabled={nome.trim().length < 2} />
              <Button title="Cancelar" variant="ghost" className="mt-2" onPress={() => setEditando(false)} />
            </View>
          </View>
        </ThemeVars>
      </Modal>
    </View>
  );
}
