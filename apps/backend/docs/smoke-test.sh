#!/usr/bin/env bash
# Смоук-тест backend ШАГ 4+5+6+8 поверх сидов из ШАГ 3 (admin@apetite.ru, user@apetite.ru,
# cafe.pushkin@apetite.ru, market.svezhest@apetite.ru — все password123). Требует
# поднятый backend (docker compose up или `pnpm dev:backend`) и применённые
# миграции+сиды (`pnpm db:migrate && pnpm db:seed`).
#
# Использование: ./smoke-test.sh [baseUrl]
# PAYMENT_WEBHOOK_SECRET можно передать через переменную окружения, если меняли
# дефолт из .env.example (change-me-webhook-secret).
set -euo pipefail

BASE="${1:-http://localhost:3000/api/v1}"
WEBHOOK_SECRET="${PAYMENT_WEBHOOK_SECRET:-change-me-webhook-secret}"
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

echo "== auth: OTP по телефону (Redis) =="
OTP_PHONE="+79990000$(( RANDOM % 900 + 100 ))"
OTP_REQUEST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/otp/request" \
  -H "Content-Type: application/json" -d "{\"phone\":\"$OTP_PHONE\"}")
check "запрос OTP-кода -> 200" 200 "$OTP_REQUEST_STATUS"

OTP_COOLDOWN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/otp/request" \
  -H "Content-Type: application/json" -d "{\"phone\":\"$OTP_PHONE\"}")
check "повторный запрос сразу же -> 409 (cooldown)" 409 "$OTP_COOLDOWN_STATUS"

# Код не возвращается в API-ответе (как и у настоящего SMS-провайдера) — берём напрямую из Redis-контейнера.
OTP_CODE=$(docker exec apetite-redis-1 redis-cli GET "otp:code:$OTP_PHONE" 2>/dev/null | tr -d '[:space:]')
if [ -n "$OTP_CODE" ]; then
  WRONG_OTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/otp/verify" \
    -H "Content-Type: application/json" -d "{\"phone\":\"$OTP_PHONE\",\"code\":\"000000\"}")
  check "верификация неверным кодом -> 409" 409 "$WRONG_OTP_STATUS"

  RIGHT_OTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/otp/verify" \
    -H "Content-Type: application/json" -d "{\"phone\":\"$OTP_PHONE\",\"code\":\"$OTP_CODE\"}")
  check "верификация верным кодом -> 200" 200 "$RIGHT_OTP_STATUS"

  REUSE_OTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/otp/verify" \
    -H "Content-Type: application/json" -d "{\"phone\":\"$OTP_PHONE\",\"code\":\"$OTP_CODE\"}")
  check "тот же код повторно -> 409 (одноразовый)" 409 "$REUSE_OTP_STATUS"

  REGISTER_WITH_PHONE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"otp-smoke-$OTP_PHONE@apetite.ru\",\"password\":\"password123\",\"name\":\"OTP Smoke\",\"phone\":\"$OTP_PHONE\"}")
  check "регистрация с подтверждённым телефоном -> 201" 201 "$REGISTER_WITH_PHONE_STATUS"

  REGISTER_UNVERIFIED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"otp-smoke-unverified@apetite.ru","password":"password123","name":"OTP Unverified","phone":"+79998887766"}')
  check "регистрация с неподтверждённым телефоном -> 409" 409 "$REGISTER_UNVERIFIED_STATUS"
else
  echo "SKIP OTP-верификация: не нашли код напрямую в Redis-контейнере (нет доступа к контейнеру?) — не критично для API"
fi

echo "== businesses =="
FORBIDDEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/businesses" \
  -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d '{"ownerEmail":"x@x.ru","ownerPassword":"password123","ownerName":"x","name":"x","category":"FOOD","address":"x","lat":55.7,"lng":37.6}')
check "USER не может создать business -> 403" 403 "$FORBIDDEN_STATUS"

BIZ_LIST_COUNT=$(curl -s "$BASE/businesses" | python3 -c "import json,sys;print(len(json.load(sys.stdin)))")
check "GET /businesses публично отдаёт список" "true" "$([ "$BIZ_LIST_COUNT" -ge 4 ] && echo true || echo false)"

MY_BIZ_ID=$(curl -s "$BASE/businesses/mine" -H "Authorization: Bearer $BUSINESS_TOKEN" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")

# Сид уже кладёт офферы/заказы на это же заведение — сверяем ШАГ 10 статистику
# дельтой между "до" и "после", а не абсолютными числами.
STATS_BEFORE=$(curl -s "$BASE/businesses/$MY_BIZ_ID/stats" -H "Authorization: Bearer $BUSINESS_TOKEN")
STATS_BEFORE_ACTIVE=$(echo "$STATS_BEFORE" | json_field "['activeOffersCount']")
STATS_BEFORE_COMPLETED=$(echo "$STATS_BEFORE" | json_field "['completedOrders']")
STATS_BEFORE_REVENUE=$(echo "$STATS_BEFORE" | json_field "['revenue']")
STATS_BEFORE_FEE=$(echo "$STATS_BEFORE" | json_field "['platformFee']")
STATS_BEFORE_KG=$(echo "$STATS_BEFORE" | json_field "['weightSavedKg']")

# То же самое для платформенной сводки ШАГ 11 — тоже дельтой, платформа не пустая.
PLATFORM_BEFORE=$(curl -s "$BASE/platform/stats" -H "Authorization: Bearer $ADMIN_TOKEN")
PLATFORM_BEFORE_GMV=$(echo "$PLATFORM_BEFORE" | json_field "['gmv']")
PLATFORM_BEFORE_REVENUE=$(echo "$PLATFORM_BEFORE" | json_field "['platformRevenue']")
PLATFORM_BEFORE_COMPLETED=$(echo "$PLATFORM_BEFORE" | json_field "['completedOrders']")

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

echo "== ШАГ 10: сводка по заведению (GET /businesses/:id/stats) =="
STATS_FORBIDDEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/businesses/$MY_BIZ_ID/stats" -H "Authorization: Bearer $USER_TOKEN")
check "USER не может смотреть статистику чужого заведения -> 403" 403 "$STATS_FORBIDDEN_STATUS"

STATS=$(curl -s "$BASE/businesses/$MY_BIZ_ID/stats" -H "Authorization: Bearer $BUSINESS_TOKEN")
STATS_ACTIVE_DELTA=$(python3 -c "print($(echo "$STATS" | json_field "['activeOffersCount']") - $STATS_BEFORE_ACTIVE)")
check "статистика: распроданный смоук-оффер не входит в активные (+0)" 0 "$STATS_ACTIVE_DELTA"
STATS_COMPLETED_DELTA=$(python3 -c "print($(echo "$STATS" | json_field "['completedOrders']") - $STATS_BEFORE_COMPLETED)")
check "статистика: +1 выданный заказ от смоук-теста" 1 "$STATS_COMPLETED_DELTA"
STATS_REVENUE_DELTA=$(python3 -c "print($(echo "$STATS" | json_field "['revenue']") - $STATS_BEFORE_REVENUE)")
check "статистика: +50000 копеек выручки (2 x 25000)" 50000 "$STATS_REVENUE_DELTA"
STATS_FEE_DELTA=$(python3 -c "print($(echo "$STATS" | json_field "['platformFee']") - $STATS_BEFORE_FEE)")
check "статистика: +12500 копеек комиссии (25% от выручки)" 12500 "$STATS_FEE_DELTA"
STATS_KG_DELTA=$(python3 -c "print(round(float($(echo "$STATS" | json_field "['weightSavedKg']")) - float($STATS_BEFORE_KG), 4))")
check "статистика: +1 кг спасено (0.5 кг x 2)" "1.0" "$STATS_KG_DELTA"

echo "== ШАГ 11: панель платформы (модерация, GMV, комиссия) =="
PLATFORM_BIZ_FORBIDDEN=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/platform/businesses" -H "Authorization: Bearer $BUSINESS_TOKEN")
check "BUSINESS не может смотреть панель платформы -> 403" 403 "$PLATFORM_BIZ_FORBIDDEN"
PLATFORM_STATS_FORBIDDEN=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/platform/stats" -H "Authorization: Bearer $USER_TOKEN")
check "USER не может смотреть GMV платформы -> 403" 403 "$PLATFORM_STATS_FORBIDDEN"

# commissionPercent — только ADMIN; BUSINESS, меняющий себе, тихо игнорируется (как и status).
COMMISSION_IGNORED=$(curl -s -X PATCH "$BASE/businesses/$MY_BIZ_ID" -H "Authorization: Bearer $BUSINESS_TOKEN" \
  -H "Content-Type: application/json" -d '{"commissionPercent":1}' | json_field "['commissionPercent']")
check "BUSINESS не может сам себе снизить комиссию" 25 "$COMMISSION_IGNORED"

COMMISSION_SET=$(curl -s -X PATCH "$BASE/businesses/$MY_BIZ_ID" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"commissionPercent":30}' | json_field "['commissionPercent']")
check "ADMIN может задать комиссию заведения" 30 "$COMMISSION_SET"
curl -s -X PATCH "$BASE/businesses/$MY_BIZ_ID" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"commissionPercent":25}' > /dev/null

PLATFORM_BIZ_LIST=$(curl -s "$BASE/platform/businesses" -H "Authorization: Bearer $ADMIN_TOKEN")
MY_BIZ_IN_LIST=$(echo "$PLATFORM_BIZ_LIST" | python3 -c "import json,sys;print(any(b['id']=='$MY_BIZ_ID' for b in json.load(sys.stdin)))")
check "GET /platform/businesses включает моё заведение" "True" "$MY_BIZ_IN_LIST"

PLATFORM_AFTER=$(curl -s "$BASE/platform/stats" -H "Authorization: Bearer $ADMIN_TOKEN")
PLATFORM_GMV_DELTA=$(python3 -c "print($(echo "$PLATFORM_AFTER" | json_field "['gmv']") - $PLATFORM_BEFORE_GMV)")
check "GMV платформы вырос минимум на выручку смоук-заказа (+50000)" "true" \
  "$([ "$PLATFORM_GMV_DELTA" -ge 50000 ] && echo true || echo false)"
PLATFORM_COMPLETED_DELTA=$(python3 -c "print($(echo "$PLATFORM_AFTER" | json_field "['completedOrders']") - $PLATFORM_BEFORE_COMPLETED)")
check "выданных заказов на платформе стало минимум на 1 больше" "true" \
  "$([ "$PLATFORM_COMPLETED_DELTA" -ge 1 ] && echo true || echo false)"
PLATFORM_REVENUE_DELTA=$(python3 -c "print($(echo "$PLATFORM_AFTER" | json_field "['platformRevenue']") - $PLATFORM_BEFORE_REVENUE)")
check "доход платформы вырос минимум на комиссию смоук-заказа (+12500)" "true" \
  "$([ "$PLATFORM_REVENUE_DELTA" -ge 12500 ] && echo true || echo false)"

echo "== ШАГ 5: гео-поиск /offers/nearby =="
NEARBY_COUNT=$(curl -s "$BASE/offers/nearby?lat=55.751244&lng=37.618423&radiusKm=20" | python3 -c "import json,sys;print(len(json.load(sys.stdin)))")
check "nearby в радиусе 20км находит офферы" "true" "$([ "$NEARBY_COUNT" -ge 1 ] && echo true || echo false)"

NEARBY_FAR_COUNT=$(curl -s "$BASE/offers/nearby?lat=0&lng=0&radiusKm=1" | python3 -c "import json,sys;print(len(json.load(sys.stdin)))")
check "nearby у экватора (далеко) не находит московские офферы" 0 "$NEARBY_FAR_COUNT"

NEARBY_BAD_LAT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/offers/nearby?lat=999&lng=37.6&radiusKm=5")
check "nearby с невалидной широтой -> 400" 400 "$NEARBY_BAD_LAT_STATUS"

echo "== ШАГ 5: mock-оплата + QR + эко-баллы =="
OFFER2_ID=$(curl -s "$BASE/offers/nearby?lat=55.751244&lng=37.618423&radiusKm=20&category=GROCERIES" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
ORDER2=$(curl -s -X POST "$BASE/orders" -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"offerId\":\"$OFFER2_ID\",\"quantity\":1}")
ORDER2_ID=$(echo "$ORDER2" | json_field "['id']")
ORDER2_CODE=$(echo "$ORDER2" | json_field "['pickupCode']")
QR_IS_PNG=$(echo "$ORDER2" | python3 -c "import json,sys;print(json.load(sys.stdin)['qrCodeDataUrl'].startswith('data:image/png;base64,'))")
check "заказ содержит QR как data:image/png" "True" "$QR_IS_PNG"

QR_ENDPOINT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/orders/$ORDER2_ID/qrcode" -H "Authorization: Bearer $USER_TOKEN")
check "GET /orders/:id/qrcode доступен владельцу" 200 "$QR_ENDPOINT_STATUS"

MARKET_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"market.svezhest@apetite.ru","password":"password123"}' | json_field "['accessToken']")
curl -s -X PATCH "$BASE/orders/$ORDER2_ID/complete" -H "Authorization: Bearer $MARKET_TOKEN" \
  -H "Content-Type: application/json" -d "{\"pickupCode\":\"$ORDER2_CODE\"}" > /dev/null

ORDER2_STATUS_AFTER=$(curl -s "$BASE/orders/$ORDER2_ID" -H "Authorization: Bearer $USER_TOKEN" | json_field "['status']")
check "заказ 2 перешёл в COMPLETED" "COMPLETED" "$ORDER2_STATUS_AFTER"

# Эко-профиль пока не отдаётся отдельным эндпоинтом (появится в ШАГ 8) — проверяем
# начисление баллов напрямую в БД, если есть доступ к контейнеру postgres.
ECO_POINTS=$(docker exec apetite-postgres-1 psql -U apetite -d apetite -t -c \
  "SELECT points FROM eco_transactions WHERE \"orderId\"='$ORDER2_ID';" 2>/dev/null | tr -d '[:space:]')
if [ -n "$ECO_POINTS" ]; then
  check "эко-баллы начислены (points > 0)" "true" "$([ "$ECO_POINTS" -gt 0 ] && echo true || echo false)"
else
  echo "SKIP эко-баллы: нет доступа к контейнеру postgres для прямой проверки — не критично для API"
fi

echo "== ШАГ 5: шедулер скидок (ручной запуск) =="
FORBIDDEN_SCHEDULER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/scheduler/run-discounts" -H "Authorization: Bearer $USER_TOKEN")
check "USER не может запустить шедулер -> 403" 403 "$FORBIDDEN_SCHEDULER_STATUS"

SOON_END=$(python3 -c "import datetime;print((datetime.datetime.utcnow()+datetime.timedelta(minutes=30)).isoformat()+'Z')")
DISCOUNT_OFFER=$(curl -s -X POST "$BASE/offers" -H "Authorization: Bearer $BUSINESS_TOKEN" -H "Content-Type: application/json" -d "{
  \"businessId\":\"$MY_BIZ_ID\",\"title\":\"Scheduler smoke offer\",\"category\":\"FOOD\",
  \"originalPriceRub\":1000,\"weightKg\":0.5,\"quantityTotal\":3,
  \"pickupStart\":\"$PICKUP_START\",\"pickupEnd\":\"$SOON_END\"
}")
DISCOUNT_OFFER_ID=$(echo "$DISCOUNT_OFFER" | json_field "['id']")
curl -s -X POST "$BASE/scheduler/run-discounts" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
DISCOUNT_AFTER=$(curl -s "$BASE/offers/$DISCOUNT_OFFER_ID" | json_field "['discountPercent']")
check "оффер с pickupEnd через 30 минут пересчитан до 70%" 70 "$DISCOUNT_AFTER"

echo "== ШАГ 5: вебхук mock-платежа =="
# externalId платежа не возвращается в API-ответе заказа — берём напрямую из БД контейнера.
EXTERNAL_ID=$(docker exec apetite-postgres-1 psql -U apetite -d apetite -t -c \
  "SELECT \"externalId\" FROM payments WHERE \"orderId\"='$ORDER2_ID';" 2>/dev/null | tr -d '[:space:]')
if [ -n "$EXTERNAL_ID" ]; then
  SIGNATURE=$(python3 -c "
import hmac, hashlib
print(hmac.new('$WEBHOOK_SECRET'.encode(), '$EXTERNAL_ID.SUCCEEDED'.encode(), hashlib.sha256).hexdigest())
")
  NO_SIG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/payments/webhook" \
    -H "Content-Type: application/json" -d "{\"externalId\":\"$EXTERNAL_ID\",\"status\":\"SUCCEEDED\"}")
  check "вебхук без подписи -> 403" 403 "$NO_SIG_STATUS"

  SIGNED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/payments/webhook" \
    -H "Content-Type: application/json" -H "x-webhook-signature: $SIGNATURE" \
    -d "{\"externalId\":\"$EXTERNAL_ID\",\"status\":\"SUCCEEDED\"}")
  check "вебхук с верной подписью -> 200" 200 "$SIGNED_STATUS"
else
  echo "SKIP вебхук: не нашли payments напрямую в БД (нет доступа к контейнеру?) — не критично для API"
fi

echo "== ШАГ 6: push-токен, геопозиция, уведомления =="
PUSH_TOKEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/notifications/push-token" \
  -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d '{"token":"ExponentPushToken[smoke-test-token]"}')
check "регистрация push-токена -> 201" 201 "$PUSH_TOKEN_STATUS"

LOCATION_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/users/me/location" \
  -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d '{"lat":55.751244,"lng":37.618423}')
check "обновление геопозиции -> 200" 200 "$LOCATION_STATUS"

FORBIDDEN_DIGEST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/notifications/run-digest" -H "Authorization: Bearer $USER_TOKEN")
check "USER не может запустить дайджест уведомлений -> 403" 403 "$FORBIDDEN_DIGEST_STATUS"

DIGEST_RESULT=$(curl -s -X POST "$BASE/notifications/run-digest" -H "Authorization: Bearer $ADMIN_TOKEN")
NEARBY_SENT=$(echo "$DIGEST_RESULT" | json_field "['nearbyDigestsSent']")
check "гео-дайджест находит офферы рядом (nearbyDigestsSent >= 1)" "true" "$([ "$NEARBY_SENT" -ge 1 ] && echo true || echo false)"

NOTIF_LIST=$(curl -s "$BASE/notifications" -H "Authorization: Bearer $USER_TOKEN")
NEARBY_TYPE_PRESENT=$(echo "$NOTIF_LIST" | python3 -c "import json,sys;d=json.load(sys.stdin);print(any(i['type']=='NEARBY_OFFERS' for i in d['items']))")
check "NEARBY_OFFERS-уведомление появилось в GET /notifications" "True" "$NEARBY_TYPE_PRESENT"

# Регрессия ШАГ 9: unreadOnly=false явной строкой в query — @Type(() => Boolean) коверкал
# её в true (JS Boolean("false") === true), из-за чего "все" фильтровались как "непрочитанные".
NOTIF_ALL_EXPLICIT_FALSE=$(curl -s "$BASE/notifications?unreadOnly=false" -H "Authorization: Bearer $USER_TOKEN" | json_field "['total']")
check "unreadOnly=false строкой отдаёт все уведомления, не пустой список" "true" "$([ "$NOTIF_ALL_EXPLICIT_FALSE" -ge 1 ] && echo true || echo false)"

DIGEST_AGAIN=$(curl -s -X POST "$BASE/notifications/run-digest" -H "Authorization: Bearer $ADMIN_TOKEN" | json_field "['nearbyDigestsSent']")
check "повторный дайджест не дублирует (throttle 3ч)" 0 "$DIGEST_AGAIN"

NOTIF_ID=$(echo "$NOTIF_LIST" | python3 -c "import json,sys;print(json.load(sys.stdin)['items'][0]['id'])")
MARK_READ_STATUS=$(curl -s -X PATCH "$BASE/notifications/$NOTIF_ID/read" -H "Authorization: Bearer $USER_TOKEN" | json_field "['read']")
check "PATCH /notifications/:id/read помечает прочитанным" "True" "$MARK_READ_STATUS"

FOREIGN_READ_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/notifications/$NOTIF_ID/read" -H "Authorization: Bearer $BUSINESS_TOKEN")
check "чужое уведомление читать нельзя -> 403" 403 "$FOREIGN_READ_STATUS"

echo "== ШАГ 6: напоминание за 30 минут до pickupEnd =="
SOON_PICKUP_END=$(python3 -c "import datetime;print((datetime.datetime.utcnow()+datetime.timedelta(minutes=20)).isoformat()+'Z')")
REMINDER_OFFER=$(curl -s -X POST "$BASE/offers" -H "Authorization: Bearer $BUSINESS_TOKEN" -H "Content-Type: application/json" -d "{
  \"businessId\":\"$MY_BIZ_ID\",\"title\":\"Reminder smoke offer\",\"category\":\"FOOD\",
  \"originalPriceRub\":300,\"weightKg\":0.3,\"quantityTotal\":2,
  \"pickupStart\":\"$PICKUP_START\",\"pickupEnd\":\"$SOON_PICKUP_END\"
}")
REMINDER_OFFER_ID=$(echo "$REMINDER_OFFER" | json_field "['id']")
REMINDER_ORDER=$(curl -s -X POST "$BASE/orders" -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"offerId\":\"$REMINDER_OFFER_ID\",\"quantity\":1}")
REMINDER_ORDER_ID=$(echo "$REMINDER_ORDER" | json_field "['id']")

REMINDER_RESULT=$(curl -s -X POST "$BASE/notifications/run-digest" -H "Authorization: Bearer $ADMIN_TOKEN")
REMINDERS_SENT=$(echo "$REMINDER_RESULT" | json_field "['pickupRemindersSent']")
check "напоминание отправлено для заказа с pickupEnd через 20 минут" "true" "$([ "$REMINDERS_SENT" -ge 1 ] && echo true || echo false)"

REMINDER_AGAIN=$(curl -s -X POST "$BASE/notifications/run-digest" -H "Authorization: Bearer $ADMIN_TOKEN" | json_field "['pickupRemindersSent']")
check "повторный запуск не дублирует напоминание" 0 "$REMINDER_AGAIN"

echo "== ШАГ 8: эко-профиль (GET /eco/me) =="
ECO_BEFORE=$(curl -s "$BASE/eco/me" -H "Authorization: Bearer $USER_TOKEN")
POINTS_BEFORE=$(echo "$ECO_BEFORE" | json_field "['totalPoints']")
LEVEL_ID_BEFORE=$(echo "$ECO_BEFORE" | json_field "['level']['id']")
check "GET /eco/me отдаёт уровень для сидового пользователя" 1 "$LEVEL_ID_BEFORE"

ECO_OFFER=$(curl -s -X POST "$BASE/offers" -H "Authorization: Bearer $BUSINESS_TOKEN" -H "Content-Type: application/json" -d "{
  \"businessId\":\"$MY_BIZ_ID\",\"title\":\"Eco smoke offer\",\"category\":\"FOOD\",
  \"originalPriceRub\":200,\"weightKg\":2.0,\"quantityTotal\":1,
  \"pickupStart\":\"$PICKUP_START\",\"pickupEnd\":\"$PICKUP_END\"
}")
ECO_OFFER_ID=$(echo "$ECO_OFFER" | json_field "['id']")
ECO_ORDER_ID=$(curl -s -X POST "$BASE/orders" -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"offerId\":\"$ECO_OFFER_ID\",\"quantity\":1}" | json_field "['id']")
ECO_PICKUP_CODE=$(curl -s "$BASE/orders/$ECO_ORDER_ID" -H "Authorization: Bearer $USER_TOKEN" | json_field "['pickupCode']")
curl -s -X PATCH "$BASE/orders/$ECO_ORDER_ID/complete" -H "Authorization: Bearer $BUSINESS_TOKEN" -H "Content-Type: application/json" \
  -d "{\"pickupCode\":\"$ECO_PICKUP_CODE\"}" > /dev/null

ECO_AFTER=$(curl -s "$BASE/eco/me" -H "Authorization: Bearer $USER_TOKEN")
POINTS_AFTER=$(echo "$ECO_AFTER" | json_field "['totalPoints']")
check "баллы выросли ровно на 20 (2 кг * 10)" $((POINTS_BEFORE + 20)) "$POINTS_AFTER"

echo
echo "Итого: $PASS ок, $FAIL провалено"
[ "$FAIL" -eq 0 ]
