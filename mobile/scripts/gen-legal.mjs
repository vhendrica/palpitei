// Embute os documentos legais de ../docs no app (não há leitor de markdown no bundle).
// Uso: node scripts/gen-legal.mjs          (gera src/lib/legal.ts)
//      node scripts/gen-legal.mjs --check  (falha se src/lib/legal.ts estiver desatualizado)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(raiz, "..", "docs");
const saida = join(raiz, "src", "lib", "legal.ts");

const ler = (nome) => readFileSync(join(docs, nome), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

// O checklist interno do advogado ("não publicar") fica fora do app.
const semChecklist = (md) => md.split(/\n---\n\n## CHECKLIST DO ADVOGADO/)[0].trimEnd() + "\n";

const docsApp = {
  REGULAMENTO_CONCURSO: semChecklist(ler("regulamento-concurso.md")),
  REGULAMENTO_MERCADOS: ler("regulamento-mercados.md"),
  POLITICA_PRIVACIDADE: ler("politica-privacidade.md"),
};

const ts =
  "// Gerado por scripts/gen-legal.mjs a partir de docs/*.md. Não edite à mão: rode `npm run legal`.\n" +
  Object.entries(docsApp)
    .map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};\n`)
    .join("");

if (process.argv.includes("--check")) {
  let atual = "";
  try {
    atual = readFileSync(saida, "utf8");
  } catch {}
  if (atual !== ts) {
    console.error("src/lib/legal.ts desatualizado: rode `npm run legal`.");
    process.exit(1);
  }
  console.log("legal.ts em dia.");
} else {
  writeFileSync(saida, ts);
  console.log("OK:", saida);
}
