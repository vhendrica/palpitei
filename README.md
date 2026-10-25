# PALPITEI // Deck 16:9

Apresentação interativa oficial do app **Palpitei** — "A emoção da BET sem o risco da BET".
Next.js (App Router) + Tailwind CSS. Palco fixo 1600x900 (16:9) que escala para qualquer tela (notebook, TV, projetor).

## Navegação

- Setas na tela ou teclado `←` / `→` (também `PageUp`/`PageDown`, `Home`/`End`)
- Swipe no celular/tablet
- Botão **Apresentar em Tela Cheia** no topo
- Slide 5: botão **Simular Abertura do App** abre o anúncio de tela cheia dentro do celular

## Rodar local

```bash
npm install
npm run dev     # http://localhost:3000
```

## Deploy na Vercel

1. Suba esta pasta para um repositório no GitHub.
2. Em https://vercel.com/new importe o repositório (Framework: **Next.js**, sem variáveis de ambiente).
3. Clique em **Deploy**.

Ou pela CLI: `npx vercel` (preview) e `npx vercel --prod` (produção).

## App dentro do celular (DEMO)

O celular mostra o app Palpitei de verdade: é o export web do projeto Expo, que fica em `public/app/` e é servido em `/app`. O deck controla o app (troca de tela a cada slide, anúncio, Premium, reset) via `postMessage`.

Para atualizar o app depois de mudar o projeto Expo:

```bash
cd ../ligas-fortaleza   # projeto Expo do Palpitei
npx expo export --platform web --output-dir ../palpitei-deck/public/app
```

(`app.json` do Expo já tem `experiments.baseUrl: "/app"`.)

## Publicar no GitHub Pages

O código do app Expo fica em `mobile/`. Para gerar o site estático (deck + app) em `out/`:

```bash
npm install && (cd mobile && npm install)
REPO=palpitei ./scripts/build-pages.sh
```

Depois publique o conteúdo de `out/` na branch `gh-pages` (Settings → Pages → Branch: `gh-pages`).
