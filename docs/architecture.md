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

### 3. Покупка → QR → самовывоз
```
Mobile: POST /orders {offerId, quantity}
  → Backend: транзакция — decrement Offer.quantityLeft, mock-оплата,
             генерация pickupCode (PIN), создание Order(status=CONFIRMED)
  → Mobile получает Order + QR (кодирует pickupCode)

Business (Admin): POST /orders/:id/complete {pickupCode}
  → Backend: сверяет код, Order.status=COMPLETED, completedAt=now()
  → Backend: создаёт EcoTransaction (points, weightSavedKg = Offer.weightKg * quantity)
  → Push пользователю "Заказ забран, +N эко-баллов"
```

### 4. Пересчёт скидок (cron, каждые 15 минут)
```
Scheduler → SELECT Offer WHERE status=ACTIVE
  для каждого: часы_до(pickupEnd)
    >2ч  → discountPercent = 50 (база)
    1–2ч → discountPercent = 60
    <1ч  → discountPercent = 70 (максимум)
  UPDATE discountedPrice, discountPercent
  → параллельно: Order с истёкшим pickupEnd и status=CONFIRMED → status=EXPIRED
Mobile получает обновлённые цены при следующем запросе списка/деталей оффера
(в бете — по pull, WebSocket/SSE push обновлений — вне скоупа).
```

### 5. Уведомления
```
Push "рядом с тобой N предложений" — geo-триггер по региону пользователя (ШАГ 6).
Push "через 30 минут закрывается самовывоз" — напоминание по pickupEnd - 30m (ШАГ 6).
Каналы: Expo Notifications, mock-режим в dev (лог вместо реальной отправки).
```

## Почему так

- **Одна БД (PostgreSQL) для всех ролей** — упрощает бету: не нужен отдельный
  сервис аналитики, агрегаты считаются SQL-запросами поверх Order/Offer.
- **Admin — одно Vite-приложение с двумя ролевыми зонами** (`/business/*`,
  `/platform/*`), а не два отдельных фронтенда — меньше дублирования кода для беты,
  разделение по role-guard на роутере.
- **Redis** используется для кэша `nearby`-запросов и очереди push-уведомлений;
  в бете допустимо без Redis (backend должен работать и без него, кэш — опционален),
  но Docker Compose поднимает его сразу, т.к. он нужен с ШАГ 5–6.
