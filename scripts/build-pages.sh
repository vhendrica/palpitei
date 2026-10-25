#!/usr/bin/env bash
# Gera o site estático para o GitHub Pages em ./out
# Uso: REPO=palpitei ./scripts/build-pages.sh
set -euo pipefail
REPO="${REPO:-palpitei}"
DECK="$(cd "$(dirname "$0")/.." && pwd)"
if [ -d "$DECK/mobile" ]; then APP_DEFAULT="$DECK/mobile"; else APP_DEFAULT="$DECK/../ligas-fortaleza"; fi
APP="${APP_DIR:-$APP_DEFAULT}"

rm -rf "$DECK/public/app"
(cd "$APP" && EXPO_BASE_URL="/$REPO/app" npx expo export --platform web --output-dir "$DECK/public/app")
(cd "$DECK" && rm -rf out .next && PAGES_BASE_PATH="/$REPO" npx next build)
touch "$DECK/out/.nojekyll"

# Volta o app para o caminho usado no `next start` local.
rm -rf "$DECK/public/app"
(cd "$APP" && npx expo export --platform web --output-dir "$DECK/public/app")
echo "OK: $DECK/out"
