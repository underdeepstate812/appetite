#!/usr/bin/env bash
# Смоук-тест backend ШАГ 4 поверх сидов из ШАГ 3 (admin@apetite.ru, user@apetite.ru,
# cafe.pushkin@apetite.ru — все password123). Требует поднятый backend (docker compose up
# или `pnpm dev:backend`) и применённые миграции+сиды (`pnpm db:migrate && pnpm db:seed`).
#
# Использование: ./smoke-test.sh [baseUrl]
set -euo pipefail

BASE="${1:-http://localhost:3000/api/v1}"
PASS=0
FAIL=0

check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "OK   $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL $desc (ожидали $expected, получили $actual)"
    FAIL=$((FAIL + 1))
  fi
}

json_field() {
  python3 -c "import json,sys;print(json.load(sys.stdin)$1)"
}

echo "== health =="
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${BASE%/api/v1}/health")
check "GET /health" 200 "$HEALTH"

echo "== auth =="
LOGIN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"user@apetite.ru","password":"password123"}')
USER_TOKEN=$(echo "$LOGIN" | json_field "['accessToken']")
USER_REFRESH=$(echo "$LOGIN" | json_field "['refreshToken']")
check "login возвращает accessToken" "true" "$([ -n "$USER_TOKEN" ] && echo true || echo false)"

ME_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/me" -H "Authorization: Bearer $USER_TOKEN")
check "GET /auth/me с токеном" 200 "$ME_STATUS"

NO_AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/me")
check "GET /auth/me без токена" 401 "$NO_AUTH_STATUS"

REFRESH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/refresh" -H "Authorization: Bearer $USER_REFRESH")
check "POST /auth/refresh" 200 "$REFRESH_STATUS"

BAD_LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"user@apetite.ru","password":"wrong"}')
check "неверный пароль -> 401" 401 "$BAD_LOGIN_STATUS"

ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@apetite.ru","password":"password123"}' | json_field "['accessToken']")
BUSINESS_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"cafe.pushkin@apetite.ru","password":"password123"}' | json_field "['accessToken']")

echo "== businesses =="
FORBIDDEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/businesses" \
  -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d '{"ownerEmail":"x@x.ru","ownerPassword":"password123","ownerName":"x","name":"x","category":"FOOD","address":"x","lat":55.7,"lng":37.6}')
check "USER не может создать business -> 403" 403 "$FORBIDDEN_STATUS"

BIZ_LIST_COUNT=$(curl -s "$BASE/businesses" | python3 -c "import json,sys;print(len(json.load(sys.stdin)))")
check "GET /businesses публично отдаёт список" "true" "$([ "$BIZ_LIST_COUNT" -ge 4 ] && echo true || echo false)"

MY_BIZ_ID=$(curl -s "$BASE/businesses/mine" -H "Authorization: Bearer $BUSINESS_TOKEN" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")

echo "== offers =="
PICKUP_START=$(python3 -c "import datetime;print(datetime.datetime.utcnow().isoformat()+'Z')")
PICKUP_END=$(python3 -c "import datetime;print((datetime.datetime.utcnow()+datetime.timedelta(hours=3)).isoformat()+'Z')")
OFFER=$(curl -s -X POST "$BASE/offers" -H "Authorization: Bearer $BUSINESS_TOKEN" -H "Content-Type: application/json" -d "{
  \"businessId\":\"$MY_BIZ_ID\",\"title\":\"Smoke test offer\",\"category\":\"FOOD\",
  \"originalPriceRub\":500,\"weightKg\":0.5,\"quantityTotal\":2,
  \"pickupStart\":\"$PICKUP_START\",\"pickupEnd\":\"$PICKUP_END\"
}")
OFFER_ID=$(echo "$OFFER" | json_field "['id']")
DISCOUNT=$(echo "$OFFER" | json_field "['discountPercent']")
check "созданный оффер: базовая скидка 50%" 50 "$DISCOUNT"
DISCOUNTED_PRICE=$(echo "$OFFER" | json_field "['discountedPrice']")
check "500 руб при 50% скидке -> 25000 копеек" 25000 "$DISCOUNTED_PRICE"

echo "== orders: полный сценарий купить -> получить код -> забрать =="
ORDER=$(curl -s -X POST "$BASE/orders" -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"offerId\":\"$OFFER_ID\",\"quantity\":2}")
ORDER_ID=$(echo "$ORDER" | json_field "['id']")
PICKUP_CODE=$(echo "$ORDER" | json_field "['pickupCode']")
ORDER_STATUS=$(echo "$ORDER" | json_field "['status']")
check "заказ создан в статусе CONFIRMED" "CONFIRMED" "$ORDER_STATUS"

QTY_LEFT=$(curl -s "$BASE/offers/$OFFER_ID" | json_field "['quantityLeft']")
check "quantityLeft уменьшился до 0 (2 из 2)" 0 "$QTY_LEFT"

OVERSELL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/orders" \
  -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"offerId\":\"$OFFER_ID\",\"quantity\":1}")
check "покупка при нулевом остатке -> 409" 409 "$OVERSELL_STATUS"

WRONG_CODE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/orders/$ORDER_ID/complete" \
  -H "Authorization: Bearer $BUSINESS_TOKEN" -H "Content-Type: application/json" -d '{"pickupCode":"000000"}')
check "неверный pickupCode -> 409" 409 "$WRONG_CODE_STATUS"

COMPLETE=$(curl -s -X PATCH "$BASE/orders/$ORDER_ID/complete" \
  -H "Authorization: Bearer $BUSINESS_TOKEN" -H "Content-Type: application/json" \
  -d "{\"pickupCode\":\"$PICKUP_CODE\"}")
COMPLETE_STATUS=$(echo "$COMPLETE" | json_field "['status']")
check "верный pickupCode -> статус COMPLETED" "COMPLETED" "$COMPLETE_STATUS"

echo
echo "Итого: $PASS ок, $FAIL провалено"
[ "$FAIL" -eq 0 ]
