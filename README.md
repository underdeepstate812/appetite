# Apetite

Витрина горячих послеобеденных предложений со скидками 50–70% на еду, цветы и
товары из кафе, ресторанов и магазинов. Заведения распродают остатки до закрытия,
пользователи забирают заказ самовывозом в течение 1–3 часов. Комиссия платформы — 25%.

Бета: рынок — Россия, пилот в Москве, цены в RUB. Подробности архитектуры,
потоков данных и решений/допущений — в [docs/architecture.md](docs/architecture.md).

## Стек

| Слой | Технологии |
|---|---|
| Mobile | React Native (Expo) + TypeScript, React Navigation |
| Backend | NestJS + TypeScript, REST API |
| БД | PostgreSQL (Prisma ORM) |
| Кэш/очереди | Redis |
| Auth | JWT + refresh, роли `user` / `business` / `admin` |
| Платежи | mock-провайдер с интерфейсом под Stripe/СБП |
| Push | Expo Notifications (mock в dev) |
| Гео | Haversine (MVP), задел на PostGIS |
| Admin | React + Vite + TypeScript |
| Инфра | Docker Compose |
| Тесты | Jest + React Native Testing Library |

## Структура репозитория

```
apps/
  mobile/     — Expo-приложение (ШАГ 7–9)
  backend/    — NestJS API (ШАГ 4–6)
  admin/      — Admin-панель для бизнеса и платформы (ШАГ 10–11)
packages/
  shared/     — общие TS-типы, enum'ы, DTO-контракты между всеми приложениями
docs/
  architecture.md — диаграмма компонентов и потоки данных
```

## Быстрый старт

Пакетный менеджер — **pnpm** (workspaces). Если pnpm не установлен:

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
```

Установка зависимостей монорепозитория:

```bash
pnpm install
```

Переменные окружения — скопировать пример (нужен для `docker compose`, backend и т.д.):

```bash
cp .env.example .env
```

### Docker Compose (ШАГ 2)

```bash
pnpm docker:up      # поднять postgres, redis, backend, admin
pnpm docker:logs    # логи всех сервисов
pnpm docker:down    # остановить
```

- `postgres` (5432) и `redis` (6379) — полноценные сервисы с healthcheck.
- `backend` (3000) — с ШАГ 4 это настоящее NestJS API (см. ниже), собирается из
  корня монорепо (нужен доступ к `@apetite/shared`).
- `admin` (5173) — всё ещё **плейсхолдер** (статичная страница), появится в ШАГ 10.
- Проверка: `curl http://localhost:3000/health` → `{"status":"ok",...}`,
  `http://localhost:5173` → страница-плейсхолдер admin.

### База данных: Prisma (ШАГ 3)

```bash
docker compose up -d postgres   # нужен живой Postgres
pnpm db:migrate                 # применить миграции (создаёт БД со схемой)
pnpm db:seed                    # наполнить тестовыми заведениями/офферами/заказами
pnpm db:studio                  # Prisma Studio — визуальный просмотр БД
```

Схема — [apps/backend/prisma/schema.prisma](apps/backend/prisma/schema.prisma) (User, Business,
Offer, Order, EcoTransaction, Notification, + `Payment` добавлен в ШАГ 5). После `db:seed` в базе:
- `admin@apetite.ru` / `password123` — платформенный админ;
- `user@apetite.ru` / `password123` — обычный пользователь, с одним завершённым
  заказом (есть EcoTransaction) и одним активным (CONFIRMED, ждёт самовывоза);
- 4 тестовых заведения (по одному на категорию) с владельцами `*@apetite.ru` / `password123`,
  5 активных офферов с разным временем до `pickupEnd` (демонстрируют все уровни скидки).

⚠️ Используется Prisma 6.19.3 (не последняя мажорная 7/8 — та ломает классический
`datasource.url` в schema.prisma и требует driver-адаптеров, см. `prisma.config.ts`
в комментарии) — сознательный выбор в пользу стабильности задокументированного API.

### Backend API (ШАГ 4)

```bash
pnpm dev:backend   # NestJS с hot-reload (ts-node-dev), нужны живые postgres+redis
```

Реализовано: конфиг с валидацией env (Joi), логирование (pino/nestjs-pino), единый
формат ошибок, auth (регистрация/вход/refresh/logout/me, роли `USER`/`BUSINESS`/`ADMIN`
через guard'ы), CRUD для Business/Offer/Order с проверкой прав на каждом эндпоинте.

Все маршруты — под `/api/v1` (кроме `/health`). Примеры:
- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`
  (`Authorization: Bearer <refreshToken>`), `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.
- `GET /api/v1/businesses` (публично), `GET /api/v1/businesses/mine` (BUSINESS),
  `POST /api/v1/businesses` (ADMIN — ручной онбординг: создаёт владельца + заведение
  одним запросом), `PATCH`/`DELETE /api/v1/businesses/:id`.
- `GET /api/v1/offers` (публично, фильтры `category`/`businessId`/`status`, пагинация),
  `POST`/`PATCH`/`DELETE /api/v1/offers/:id` (владелец заведения или ADMIN).
- `POST /api/v1/orders` (USER, атомарная резервация `quantityLeft`), `GET /api/v1/orders`
  (список по роли: свои / заказы своего заведения / все), `PATCH /api/v1/orders/:id/cancel`,
  `PATCH /api/v1/orders/:id/complete` (BUSINESS/ADMIN, сверяет `pickupCode`).

⚠️ Известное упрощение: контейнер backend запускает `ts-node` напрямую (не
компилирует в `dist/`), т.к. `@apetite/shared` подключён как TS-исходники —
компилируемая прод-сборка (`pnpm build`) осталась для более поздней оптимизации
(ШАГ 12–13).

### Backend: бизнес-логика (ШАГ 5)

Добавлено поверх ШАГ 4:
- `GET /api/v1/offers/nearby?lat&lng&radiusKm&category&minDiscount` — гео-поиск,
  Haversine на raw SQL (задел на PostGIS при росте нагрузки, см. ШАГ 0).
- Полный сценарий покупки в `POST /api/v1/orders`: атомарная резервация
  `quantityLeft` → mock-оплата через `PaymentsService` (интерфейс `PaymentProvider`,
  готов к замене на Stripe/СБП одним классом + DI-биндингом) → запись `Payment` →
  заказ в ответе уже содержит `qrCodeDataUrl` (`data:image/png;base64,...`,
  кодирует `{orderId, pickupCode}`); повторно — `GET /api/v1/orders/:id/qrcode`.
- `POST /api/v1/payments/webhook` — вебхук провайдера с HMAC-подписью
  (`x-webhook-signature`, секрет `PAYMENT_WEBHOOK_SECRET`), идемпотентно обновляет
  статус `Payment` по `externalId`. У mock-провайдера оплата уже синхронно
  успешна при создании заказа, так что в обычном сценарии вебхук не требуется —
  эндпоинт демонстрирует контракт, который понадобится реальному провайдеру.
- `PATCH /api/v1/orders/:id/complete` теперь также начисляет `EcoTransaction`
  (баллы = `weightSavedKg * ECO_POINTS_PER_KG`) и создаёт `Notification`.
- Шедулер (`@nestjs/schedule`, `DISCOUNT_CRON_EXPRESSION` — каждые 15 минут):
  пересчитывает `discountPercent`/`discountedPrice` активных офферов по правилу
  из ШАГ 0 (>2ч — 50%, 1–2ч — 60%, <1ч — 70%), архивирует офферы с истёкшим
  `pickupEnd`, переводит `CONFIRMED`-заказы с истёкшим `pickupEnd` в `EXPIRED`
  (без возврата `quantityLeft` — допущение ШАГ 0). Ручной запуск для
  отладки/демо: `POST /api/v1/scheduler/run-discounts` (ADMIN).

⚠️ Модель `Payment` — дополнение сверх исходного списка сущностей (User, Business,
Offer, Order, EcoTransaction, Notification): без неё вебхук нечего было бы
идемпотентно обновлять по `externalId`. Если это лишнее для беты — скажи, уберём
и оставим оплату полностью эфемерной (без персистентного audit trail).

### Backend: уведомления (ШАГ 6)

Добавлено поверх ШАГ 5:
- `POST /api/v1/notifications/push-token` (любая роль) — регистрирует Expo push-токен
  устройства (`User.expoPushToken`, одно устройство на аккаунт — упрощение для беты).
- `PATCH /api/v1/users/me/location` — сохраняет последнюю геопозицию (`lastLat`/`lastLng`);
  то, что вызовет мобильное приложение при выдаче геопермишена (ШАГ 9).
- Гео-триггер «рядом с тобой N предложений»: шедулер считает для каждого
  пользователя с известной геопозицией число `ACTIVE`-офферов в радиусе
  `notifyRadiusKm` (Haversine, один SQL-запрос по всем пользователям сразу, без
  N+1) и шлёт дайджест — не чаще раза в `NEARBY_DIGEST_THROTTLE_HOURS` (3 часа)
  на пользователя, чтобы не спамить при каждом новом оффере.
- Напоминание за `PICKUP_REMINDER_WINDOW_MINUTES` (30 минут) до `pickupEnd`:
  поле `Order.pickupReminderSentAt` гарантирует, что уведомление уходит один раз.
- Оба джоба используют тот же крон, что и пересчёт скидок (ШАГ 5, `DISCOUNT_CRON_EXPRESSION`,
  каждые 15 минут) — один общий "пульс" вместо нескольких параллельных расписаний.
  Ручной запуск для отладки/демо: `POST /api/v1/notifications/run-digest` (ADMIN).
- `GET /api/v1/notifications` (свои, фильтр `unreadOnly`, пагинация),
  `PATCH /api/v1/notifications/:id/read`.
- Push — за интерфейсом `PushProvider` (как и `PaymentProvider` в ШАГ 5): сейчас
  единственная реализация — мок (пишет в лог вместо реального Expo Push API,
  `EXPO_PUSH_MODE=mock`), настоящий `expo-server-sdk` подключается тем же
  DI-биндингом без изменений в `NotificationsService`.

**Проверка** (curl-коллекция + Postman):
```bash
pnpm dev:backend &                          # или docker compose up -d
bash apps/backend/docs/smoke-test.sh        # 38 сценариев: ШАГ 4 + ШАГ 5 + ШАГ 6 + ШАГ 8
```
Postman-коллекция — [apps/backend/docs/apetite-backend.postman_collection.json](apps/backend/docs/apetite-backend.postman_collection.json)
(импортировать и прогонять запросы по порядку сверху вниз, токены/id сохраняются
в переменные коллекции автоматически; папки Scheduler/Payments/Notifications & Geo —
для ШАГ 5–6).

### Mobile: каркас (ШАГ 7)

```bash
cd apps/mobile && cp .env.example .env   # своя копия — Metro не читает корневой .env
pnpm dev:mobile                          # интерактивный Expo CLI (w/i/a — web/iOS/Android)
```

Expo SDK 57 + React Navigation v7 (native-stack + bottom-tabs), Zustand (`authStore`),
react-i18next (RU/EN, автоопределение локали устройства), собственная светлая/тёмная
тема (прокинута и в навигацию).

⚠️ По пути добавил `app.enableCors()` в backend (`apps/backend/src/main.ts`) — без
этого любой веб-клиент (mobile web сейчас, admin-панель в ШАГ 10) получает "Failed to
fetch" из браузера. Не мобильно-специфичный фикс, но обнаружился именно здесь.

⚠️ Заодно поправил дрейф между `@apetite/shared` (писался в ШАГ 1 "на будущее") и
реальными ответами backend из ШАГ 4–6: `Business.location: GeoPoint` → `lat`/`lng`
плоскими полями (как реально отдаёт API), `User` донёс `expoPushToken`/`lastLat`/
`lastLng`/`notifyRadiusKm` (ШАГ 6), `CompletePickupRequest` лишился лишнего `orderId`
(он в URL, не в body), добавлен `NearbyOffer` под реальный ответ `/offers/nearby`.

### Mobile: основной сценарий (ШАГ 8)

Главный экран (Сейчас/Вечерние + фильтр категории + реальный гео-поиск), карточка с
countdown-таймером и остатком, Checkout → mock-оплата → экран с QR и pickup-кодом,
«Мои заказы» со статусами и деталью (QR повторно, отмена), эко-профиль (баллы/кг/уровень).
Карта — `react-native-maps` на native, честный список-фолбэк на web (библиотека не
реализует web). Новый backend-эндпоинт `GET /eco/me` (см. выше, добавлен в ШАГ 5/6
блок кода — фактически ШАГ 8, т.к. понадобился мобильному экрану). Подробности,
известные упрощения (fixed quantity=1, `Alert.alert` не работает в react-native-web) и
что именно проверено вживую — в [apps/mobile/README.md](apps/mobile/README.md).

Дальше (появится в следующих шагах):
- `pnpm dev:admin` — запуск admin в dev-режиме (ШАГ 10).

Полный гайд по запуску, переменным окружения, сидам и тестам будет собран в
**ШАГ 13** — сейчас справочно смотри [.env.example](.env.example).

## Статус

Проект в разработке пошагово (ШАГ 0…ШАГ 14). Текущий прогресс и допущения по
продукту — см. план шага 0 и архитектурные решения в
[docs/architecture.md](docs/architecture.md).

## Лицензия

Proprietary — см. [LICENSE](LICENSE).
