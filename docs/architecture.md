# Архитектура Apetite (бета)

## Компоненты

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Mobile (Expo)   │     │  Admin (Vite)     │     │  Admin (Vite)   │
│  React Native    │     │  Business panel   │     │  Platform panel │
│  роль: user      │     │  роль: business   │     │  роль: admin    │
└────────┬─────────┘     └─────────┬─────────┘     └────────┬────────┘
         │  REST + JWT             │  REST + JWT             │ REST + JWT
         └────────────┬────────────┴────────────┬────────────┘
                       │                         │
                 ┌─────▼─────────────────────────▼─────┐
                 │        Backend (NestJS API)          │
                 │  Auth · Business · Offer · Order ·   │
                 │  Eco · Notification modules          │
                 │  + Cron scheduler (discount, expiry) │
                 └───┬───────────────┬───────────────┬──┘
                     │               │               │
              ┌──────▼─────┐  ┌──────▼──────┐  ┌─────▼──────────┐
              │ PostgreSQL │  │    Redis     │  │ Expo Push API   │
              │ (Prisma)   │  │ (cache/queue)│  │ (mock в dev)    │
              └────────────┘  └─────────────┘  └─────────────────┘
```

`packages/shared` — общие TypeScript-типы, enum'ы и DTO-контракты, на которые
опираются backend, admin и mobile (единый источник правды для форм API).

## Роли и точки входа

- **user** (мобильное приложение) — просмотр офферов рядом, покупка (mock-оплата),
  QR/PIN самовывоза, эко-профиль.
- **business** (Admin-панель, раздел бизнеса) — создание/редактирование офферов,
  подтверждение выдачи заказов, аналитика по своему заведению.
- **admin** (Admin-панель, раздел платформы) — модерация заведений (ручной онбординг,
  ШАГ 0), метрики GMV/комиссии, управление категориями.

## Ключевые потоки данных

### 1. Auth
`Mobile/Admin → POST /auth/login|register → Backend → PostgreSQL(User)`
Backend выдаёт `accessToken` (короткоживущий) + `refreshToken`; роль (`USER` /
`BUSINESS` / `ADMIN`) зашита в JWT-claims и проверяется guard'ами NestJS.

### 2. Поиск предложений рядом
`Mobile → GET /offers/nearby?lat&lng&radiusKm&category&minDiscount`
`→ Backend считает расстояние (Haversine, задел на PostGIS) → PostgreSQL(Offer join Business)`
`→ отсортированный список по расстоянию/скидке`.

### 3. Покупка → QR → самовывоз (реализовано в ШАГ 4–5)
```
Mobile: POST /orders {offerId, quantity}
  → Backend: атомарная резервация Offer.quantityLeft (условный updateMany)
  → Backend: PaymentsService.charge() — mock-провайдер, синхронно SUCCEEDED
             (интерфейс PaymentProvider готов к замене на Stripe/СБП)
  → Backend: создание Order(status=CONFIRMED) + Payment(status=SUCCEEDED) в транзакции
  → Mobile получает Order с qrCodeDataUrl (кодирует {orderId, pickupCode})

Business (Admin): PATCH /orders/:id/complete {pickupCode}
  → Backend: сверяет код, Order.status=COMPLETED, completedAt=now()
  → Backend: создаёт EcoTransaction (points, weightSavedKg = Offer.weightKg * quantity)
             + Notification(ORDER_COMPLETED) в той же транзакции
  → Push пользователю "Заказ забран, +N эко-баллов" (реальная отправка — ШАГ 6)
```

### 4. Пересчёт скидок (cron, каждые 15 минут — реализовано в ШАГ 5)
```
Scheduler (@nestjs/schedule, DISCOUNT_CRON_EXPRESSION) → SELECT Offer WHERE status=ACTIVE
  для каждого: часы_до(pickupEnd)
    <=0  → status = ARCHIVED (окно самовывоза закрылось)
    >2ч  → discountPercent = 50 (база)
    1–2ч → discountPercent = 60
    <1ч  → discountPercent = 70 (максимум)
  UPDATE discountedPrice, discountPercent
  → параллельно: Order с истёкшим Offer.pickupEnd и status=CONFIRMED → status=EXPIRED
    (quantityLeft НЕ возвращается — допущение ШАГ 0)
Ручной запуск для отладки: POST /scheduler/run-discounts (ADMIN).
Mobile получает обновлённые цены при следующем запросе списка/деталей оффера
(в бете — по pull, WebSocket/SSE push обновлений — вне скоупа).
```

### 5. Уведомления (реализовано в ШАГ 6, тот же 15-минутный крон, что и скидки)
```
Mobile: PATCH /users/me/location {lat, lng} → User.lastLat/lastLng
Mobile: POST /notifications/push-token {token} → User.expoPushToken

Scheduler (раз в 15 минут):
  Nearby-дайджест:
    SELECT users × businesses × ACTIVE offers, Haversine <= User.notifyRadiusKm,
    WHERE не было NEARBY_OFFERS за последние NEARBY_DIGEST_THROTTLE_HOURS (3ч)
    → Notification(NEARBY_OFFERS) + push "рядом с тобой N предложений" на пользователя
  Pickup-напоминания:
    SELECT Order WHERE status=CONFIRMED AND pickupReminderSentAt IS NULL
      AND Offer.pickupEnd в ближайшие PICKUP_REMINDER_WINDOW_MINUTES (30 мин)
    → Order.pickupReminderSentAt=now(), Notification(PICKUP_REMINDER) + push

Каналы: Expo Notifications за интерфейсом PushProvider — сейчас mock (лог вместо
реальной отправки, EXPO_PUSH_MODE=mock), тот же DI-паттерн, что PaymentProvider (ШАГ 5).
Ручной запуск для отладки: POST /notifications/run-digest (ADMIN).
```

## Почему так

- **Одна БД (PostgreSQL) для всех ролей** — упрощает бету: не нужен отдельный
  сервис аналитики, агрегаты считаются SQL-запросами поверх Order/Offer.
- **Admin — одно Vite-приложение с двумя ролевыми зонами** (`/business/*`,
  `/platform/*`), а не два отдельных фронтенда — меньше дублирования кода для беты,
  разделение по role-guard на роутере.
- **Redis** зарезервирован под кэш `nearby`-запросов и очередь push-уведомлений
  (ШАГ 6) — поднимается в Docker Compose с ШАГ 2, но backend его ещё не использует:
  `/offers/nearby` в ШАГ 5 читает Haversine-запрос напрямую из PostgreSQL, этого
  достаточно на масштабе беты. Подключим, когда появится реальная нагрузка/push-очередь.
