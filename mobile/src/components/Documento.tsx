import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDesktop } from "../lib/desktop";
import { AppHeader } from "./AppHeader";
import { T } from "./ui";

// Negrito (**x**) e itálico (*x*) dentro de uma linha do documento.
function Inline({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <T key={i} className="font-mont-b">
            {p.slice(2, -2)}
          </T>
        ) : p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
          <T key={i} style={{ fontStyle: "italic" }}>
            {p.slice(1, -1)}
          </T>
        ) : (
          p
        ),
      )}
    </>
  );
}

function Bloco({ linha }: { linha: string }) {
  if (linha.startsWith("### "))
    return (
      <T className="mb-2 mt-3 font-mont-b text-sm">
        <Inline texto={linha.slice(4)} />
      </T>
    );
  if (linha.startsWith("## "))
    return (
      <T className="mb-3 mt-2 font-mont-xb text-base">
        <Inline texto={linha.slice(3)} />
      </T>
    );
  if (linha.startsWith("# "))
    return (
      <T className="mb-3 font-mont-xb text-xl">
        <Inline texto={linha.slice(2)} />
      </T>
    );
  if (linha === "---") return <View className="my-4 h-px bg-line" />;
  if (linha.startsWith("> "))
    return (
      <View className="mb-1 rounded-md bg-cardAlt px-3 py-2">
        <T className="text-xs text-muted">
          <Inline texto={linha.slice(2)} />
        </T>
      </View>
    );
  if (linha.startsWith("- "))
    return (
      <View className="mb-2 flex-row">
        <T className="mr-2 text-sm leading-5">•</T>
        <T className="flex-1 text-sm leading-5">
          <Inline texto={linha.slice(2)} />
        </T>
      </View>
    );
  return (
    <T className="mb-3 text-sm leading-5 text-fg/90">
      <Inline texto={linha} />
    </T>
  );
}

export function Documento({
  titulo,
  md,
  links = [],
}: {
  titulo: string;
  md: string;
  links?: { label: string; href: Href }[];
}) {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title={titulo} back />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 32,
          ...(desktop
            ? { width: "100%", maxWidth: 760, alignSelf: "center", paddingTop: 32 }
            : {}),
        }}
      >
        {md
          .split("\n")
          .filter((l) => l.trim())
          .map((l, i) => (
            <Bloco key={i} linha={l.trim()} />
          ))}
        {links.length ? <View className="my-4 h-px bg-line" /> : null}
        {links.map((l) => (
          <LinkDoc key={l.label} href={l.href} className="mb-3 text-sm">
            {l.label}
          </LinkDoc>
        ))}
      </ScrollView>
    </View>
  );
}

// Texto tocável que abre outro documento. Funciona aninhado em outro <T>.
export function LinkDoc({
  href,
  children,
  className = "",
}: {
  href: Href;
  children: ReactNode;
  className?: string;
}) {
  // Link renderiza <a href> no web (Enter e leitor de tela funcionam); stopPropagation evita marcar o checkbox pai.
  return (
    <Link href={href} asChild onPress={(e) => e.stopPropagation()}>
      <T className={`font-mont-b text-primary underline ${className}`}>
        {children}
      </T>
    </Link>
  );
}

export const DOCUMENTOS: { label: string; href: Href }[] = [
  { label: "Termos de Uso", href: "/termos" },
  { label: "Regulamento de Mercados", href: "/regulamento" },
  { label: "Política de Privacidade", href: "/privacidade" },
];

// Rodapé com os documentos legais, em uma linha que quebra no celular.
export function RodapeLegal({ className = "" }: { className?: string }) {
  return (
    <View className={`flex-row flex-wrap justify-center gap-x-4 gap-y-1 ${className}`}>
      {DOCUMENTOS.map((d) => (
        <LinkDoc key={d.label} href={d.href} className="font-mont text-[11px] text-muted">
          {d.label}
        </LinkDoc>
      ))}
    </View>
  );
}
