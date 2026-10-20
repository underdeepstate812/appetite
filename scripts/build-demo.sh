#!/usr/bin/env bash
# Собирает автономное демо для GitHub Pages: сайт покупателя, кабинет бизнеса и мобильную версию (веб-сборка) без backend.
# Данные подставляет @apetite/demo (встроенный in-memory backend), так что сервер и база не нужны.
#
#   bash scripts/build-demo.sh                 # → site/ (для адреса вида https://<user>.github.io/appetite/)
#   DEMO_BASE=/my-repo bash scripts/build-demo.sh
#   DEMO_BASE= DEMO_OUT=site bash scripts/build-demo.sh   # корень домена
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="${DEMO_BASE-/appetite}"
OUT="${DEMO_OUT:-site}"
# Адрес «backend» ненастоящий: запросы к нему перехватывает демо-слой, наружу ничего не уходит.
API="https://demo.apetite.invalid/api/v1"

rm -rf "$OUT" && mkdir -p "$OUT"

pnpm --filter @apetite/shared build
pnpm --filter @apetite/demo build

# Картинки блюд из сида отдаём статикой каждому приложению (public/demo/*.jpg → <base>/demo/*.jpg).
for app in web admin mobile; do
  mkdir -p "apps/$app/public/demo"
  cp apps/backend/prisma/seed-images/*.jpg "apps/$app/public/demo/"
done

echo "→ сайт покупателя"
VITE_DEMO=1 VITE_API_BASE_URL="$API" pnpm --filter @apetite/web exec vite build --base "$BASE/web/" --outDir "../../$OUT/web" --emptyOutDir
echo "→ кабинет бизнеса"
VITE_DEMO=1 VITE_API_BASE_URL="$API" pnpm --filter @apetite/admin exec vite build --base "$BASE/admin/" --outDir "../../$OUT/admin" --emptyOutDir
echo "→ мобильная версия"
EXPO_PUBLIC_DEMO=1 EXPO_PUBLIC_API_BASE_URL="$API" EXPO_BASE_URL="$BASE/mobile" EXPO_PUBLIC_BASE_PATH="$BASE/mobile" \
  pnpm --filter @apetite/mobile exec expo export --platform web --output-dir "../../$OUT/mobile"

# Витрина демо (страница выбора) и запасной 404.html для обновления страницы на клиентских маршрутах.
sed "s#__BASE__#$BASE#g" scripts/demo-site/index.html > "$OUT/index.html"
sed "s#__BASE__#$BASE#g" scripts/demo-site/404.html > "$OUT/404.html"
touch "$OUT/.nojekyll"
echo "Готово: $OUT/  (адрес на Pages: <user>.github.io$BASE/)"
