"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { IconChevronLeft, IconChevronRight, IconCompress, IconExpand } from "./icons";
import { LivePhone } from "./LivePhone";
import { LogoMark } from "./Logo";
import { SLIDES, type Slide } from "./slides";

const W = 1600;
const H = 900;

function subscribeResize(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
const getScale = () => Math.min(window.innerWidth / W, window.innerHeight / H);

function subscribeFullscreen(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}
const getFullscreen = () => !!document.fullscreenElement;

export function Deck() {
  const [idx, setIdx] = useState(0);
  const scale = useSyncExternalStore(subscribeResize, getScale, () => 1);
  const full = useSyncExternalStore(subscribeFullscreen, getFullscreen, () => false);
  const total = SLIDES.length;
  const startX = useRef<number | null>(null);

  const go = useCallback(
    (d: number) => setIdx((i) => Math.min(total - 1, Math.max(0, i + d))),
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") setIdx(0);
      else if (e.key === "End") setIdx(total - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total]);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-bg">
      <div
        className="relative shrink-0 overflow-hidden bg-bg select-none"
        style={{ width: W, height: H, transform: `scale(${scale})` }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") startX.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
        }}
      >
        <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between border-b border-white/5 px-10">
          <div className="flex items-center gap-3">
            <LogoMark size={30} />
            <span className="text-[15px] font-black tracking-[0.2em]">
              PALPITEI
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="text-xs font-semibold text-white/35">Use ← → para navegar</span>
            <button
              type="button"
              onClick={toggleFull}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-neon/60 px-5 py-2 text-[13px] font-extrabold text-neon transition hover:bg-neon hover:text-black"
            >
              {full ? <IconCompress size={16} /> : <IconExpand size={16} />}
              {full ? "Sair da Tela Cheia" : "Apresentar em Tela Cheia"}
            </button>
          </div>
        </header>

        <div className="absolute inset-x-0 bottom-0 top-16 flex">
          <div className="relative w-[40%] overflow-hidden">
            <div
              className="flex h-full transition-transform duration-500 ease-[cubic-bezier(.7,0,.2,1)]"
              style={{ width: `${total * 100}%`, transform: `translateX(-${(idx * 100) / total}%)` }}
            >
              {SLIDES.map((s, i) => (
                <SlideText key={s.tag} slide={s} active={i === idx} width={`${100 / total}%`} />
              ))}
            </div>
          </div>
          <div
            className="relative flex w-[60%] items-center justify-center"
            style={{ background: "radial-gradient(circle at 50% 50%, #1E1E1E 0%, #181818 35%, #121212 70%)" }}
          >
            <LivePhone slide={SLIDES[idx]} />
          </div>
        </div>

        <NavButton side="left" disabled={idx === 0} onClick={() => go(-1)} />
        <NavButton side="right" disabled={idx === total - 1} onClick={() => go(1)} />

        <div className="absolute bottom-7 left-24 z-20 flex gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.tag}
              type="button"
              aria-label={`Ir para slide ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-1.5 cursor-pointer rounded-full transition-all ${i === idx ? "w-10 bg-neon" : "w-4 bg-white/20 hover:bg-white/40"}`}
            />
          ))}
        </div>
        <div className="absolute bottom-6 right-10 z-20 rounded-full border border-white/10 bg-card px-4 py-1.5 text-sm font-black tracking-widest">
          <span className="text-neon">{idx + 1}</span> / {total}
        </div>
      </div>
    </div>
  );
}

function NavButton({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  const Icon = side === "left" ? IconChevronLeft : IconChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Slide anterior" : "Próximo slide"}
      onClick={onClick}
      disabled={disabled}
      className={`absolute top-1/2 z-20 flex h-14 w-14 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-card/80 text-white backdrop-blur transition hover:border-neon hover:text-neon disabled:cursor-default disabled:opacity-20 disabled:hover:border-white/10 disabled:hover:text-white ${side === "left" ? "left-6" : "right-6"}`}
    >
      <Icon size={26} />
    </button>
  );
}

function SlideText({ slide, active, width }: { slide: Slide; active: boolean; width: string }) {
  return (
    <section className="flex h-full shrink-0 flex-col justify-center pl-24 pr-8" style={{ width }} aria-hidden={!active}>
      <h1 className="font-black leading-[0.95] tracking-tight" style={{ fontSize: slide.titleSize ?? 64 }}>
        {slide.title}
      </h1>
      {slide.subtitle ? (
        <p className="mt-5 whitespace-pre-line text-[26px] font-bold leading-tight text-white/75">{slide.subtitle}</p>
      ) : null}
      <ul className="mt-10 space-y-4">
        {slide.bullets.map((b) => (
          <li key={b} className="flex items-start gap-3.5 text-[21px] font-semibold leading-snug text-white/90">
            <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neon/15">
              <span className="h-2.5 w-2.5 rounded-full bg-neon" />
            </span>
            {b}
          </li>
        ))}
      </ul>
    </section>
  );
}
