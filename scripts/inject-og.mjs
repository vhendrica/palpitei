// Injeta meta Open Graph nos HTMLs estáticos do export (modo SPA não gera
// <head> por rota). Roda no fim do build-pages.sh, depois das cópias de rota.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = process.env.REPO || "palpitei";
const IMG = `https://vhendrica.github.io/${REPO}/og.png`;

const T_GENERICO = "PALPIT — Palpites com os amigos";
const D_GENERICO = "Distribua suas fichas nos jogos do dia e dispute o prêmio.";
const T_CONVITE = "Você foi desafiado no PALPIT";
const D_CONVITE = "Entre no desafio, distribua suas fichas e dispute o prêmio.";

const og = (t, d) =>
  `    <meta property="og:title" content="${t}" />\n` +
  `    <meta property="og:description" content="${d}" />\n` +
  `    <meta property="og:type" content="website" />\n` +
  `    <meta property="og:image" content="${IMG}" />`;

const inject = (file, titulo, desc) => {
  const s = readFileSync(file, "utf8");
  if (s.includes("og:image")) return;
  writeFileSync(file, s.replace("</title>", `</title>\n${og(titulo, desc)}`));
};

const htmls = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "index.html") htmls.push(p);
  }
};
walk(join("out", "app"));

for (const f of htmls) {
  const convite = f.includes("convite");
  inject(f, convite ? T_CONVITE : T_GENERICO, convite ? D_CONVITE : D_GENERICO);
}
inject(join("out", "404.html"), T_GENERICO, D_GENERICO);
console.log(`OG injetado em ${htmls.length + 1} páginas.`);
