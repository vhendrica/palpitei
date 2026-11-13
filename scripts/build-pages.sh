#!/usr/bin/env bash
# Gera o site estático para o GitHub Pages em ./out
# Uso: REPO=palpitei ./scripts/build-pages.sh
set -euo pipefail
# Git Bash/MSYS converte valores tipo "/palpitei" em "C:/Program Files/Git/palpitei"
# ao passar env vars para binários Windows — desliga a conversão.
export MSYS2_ARG_CONV_EXCL="*"
export MSYS2_ENV_CONV_EXCL="*"
REPO="${REPO:-palpitei}"
DECK="$(cd "$(dirname "$0")/.." && pwd)"
if [ -d "$DECK/mobile" ]; then APP_DEFAULT="$DECK/mobile"; else APP_DEFAULT="$DECK/../ligas-fortaleza"; fi
APP="${APP_DIR:-$APP_DEFAULT}"

rm -rf "$DECK/public/app"
(cd "$APP" && EXPO_BASE_URL="/$REPO/app" npx expo export --platform web --output-dir ../public/app)
(cd "$DECK" && rm -rf out .next && PAGES_BASE_PATH="/$REPO" npx next build)
touch "$DECK/out/.nojekyll"
# App em modo "single": copia o index.html para cada rota, para links diretos/F5 funcionarem no Pages.
for r in entrar cadastro codigo palpiteiros ranking perfil admin historico desafio/criar desafio/convite; do
  mkdir -p "$DECK/out/app/$r" && cp "$DECK/out/app/index.html" "$DECK/out/app/$r/index.html"
done
# Fallback SPA: F5/link direto em rota dinâmica (desafio/<id>, historico/<id> etc.) carrega o app.
cp "$DECK/out/app/index.html" "$DECK/out/404.html"

# Volta o app para o caminho usado no `next start` local.
rm -rf "$DECK/public/app"
(cd "$APP" && npx expo export --platform web --output-dir ../public/app)
echo "OK: $DECK/out"
