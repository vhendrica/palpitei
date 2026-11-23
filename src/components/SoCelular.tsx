"use client";

import { useEffect, useState } from "react";

import { Phone } from "./Phone";

const APP_W = 390;
const APP_SCALE = 336 / APP_W;
const ALTURA = 764;

/** Só o celular com o app real dentro, centralizado e reduzido para caber na tela. */
export function SoCelular() {
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const ajustar = () => setEscala(Math.min(1, (window.innerHeight - 24) / ALTURA, (window.innerWidth - 24) / 384));
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  return (
    <main className="flex h-full items-center justify-center overflow-hidden">
      <div style={{ transform: `scale(${escala})` }}>
        <Phone>
          <div className="h-full w-full bg-white pb-[14px]">
            <div className="relative h-full w-full overflow-hidden">
              <iframe
                src={`${process.env.NEXT_PUBLIC_BASE_PATH}/app/`}
                title="App Palpit"
                className="absolute left-0 top-0 origin-top-left border-0 bg-white"
                style={{ width: APP_W, height: `${100 / APP_SCALE}%`, transform: `scale(${APP_SCALE})` }}
              />
            </div>
          </div>
        </Phone>
      </div>
    </main>
  );
}
