"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IconCrown, IconPlay, IconRefresh } from "./icons";
import { Phone } from "./Phone";
import type { Slide } from "./slides";

type AppState = { hasUser: boolean; premium: boolean };
type Comando =
  | { type: "palpitei:ensureUser" }
  | { type: "palpitei:navigate"; path: string }
  | { type: "palpitei:openApp" }
  | { type: "palpitei:premium"; value: boolean }
  | { type: "palpitei:reset" };

// O app é renderizado na largura de um iPhone real (390px) e reduzido para caber no mockup.
const APP_W = 390;
const APP_SCALE = 336 / APP_W;

/** Celular com o app Palpitei real (export web em /app) rodando dentro. */
export function LivePhone({ slide }: { slide: Slide }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [app, setApp] = useState<AppState | null>(null);

  const send = useCallback((msg: Comando) => {
    frame.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "palpitei:state") setApp({ hasUser: !!e.data.hasUser, premium: !!e.data.premium });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const hasUser = app?.hasUser;
  useEffect(() => {
    if (hasUser === undefined || slide.kind === "demo") return;
    send({ type: "palpitei:ensureUser" });
    if (hasUser && slide.route) send({ type: "palpitei:navigate", path: slide.route });
  }, [hasUser, slide.kind, slide.route, send]);

  // Setas do teclado continuam trocando de slide mesmo com o foco dentro do app.
  const onLoad = () => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    w.addEventListener("keydown", (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (["ArrowLeft", "ArrowRight", "PageUp", "PageDown"].includes(e.key)) {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: e.key }));
      }
    });
  };

  return (
    <div className="relative">
      <Phone>
        <div className="h-full w-full bg-white pb-[14px]">
          <div className="relative h-full w-full overflow-hidden">
            <iframe
              ref={frame}
              src={`${process.env.NEXT_PUBLIC_BASE_PATH}/app/`}
              title="App Palpitei"
              onLoad={onLoad}
              className="absolute left-0 top-0 origin-top-left border-0 bg-white"
              style={{ width: APP_W, height: `${100 / APP_SCALE}%`, transform: `scale(${APP_SCALE})` }}
            />
          </div>
        </div>
      </Phone>


      {slide.kind === "monetizacao" ? (
        <SidePanel>
          <SideButton primary onClick={() => send({ type: "palpitei:openApp" })} icon={<IconPlay size={16} />}>
            Simular Abertura do App
          </SideButton>
          <SideButton onClick={() => send({ type: "palpitei:premium", value: !app?.premium })} icon={<IconCrown size={16} />}>
            {app?.premium ? "Voltar para grátis" : "Ver como Premium"}
          </SideButton>
          <p className="text-[12px] font-semibold leading-snug text-white/45">
            {app?.premium ? "Premium: sem anúncios e +100 PONTOS por login diário." : "Grátis: banner no rodapé + anúncio de tela cheia."}
          </p>
        </SidePanel>
      ) : null}

      {slide.kind === "demo" ? (
        <SidePanel>
          <SideButton primary onClick={() => send({ type: "palpitei:reset" })} icon={<IconRefresh size={16} />}>
            Começar do cadastro
          </SideButton>
          <p className="text-[12px] font-semibold leading-snug text-white/45">
            Zera a demo e abre o app como um usuário novo.
          </p>
        </SidePanel>
      ) : null}
    </div>
  );
}

function SidePanel({ children }: { children: React.ReactNode }) {
  return <div className="absolute right-[calc(100%+36px)] top-1/2 flex w-[250px] -translate-y-1/2 flex-col gap-3">{children}</div>;
}

function SideButton({
  children,
  onClick,
  icon,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-3 text-[14px] font-black transition hover:scale-105 ${
        primary ? "neon-glow bg-neon text-black" : "border border-neon/60 text-neon hover:bg-neon/10"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
