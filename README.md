# Apetite

Витрина горячих послеобеденных предложений со скидками 50–70% на еду, цветы и
товары из кафе, ресторанов и магазинов. Заведения распродают остатки до закрытия,
пользователи забирают заказ самовывозом в течение 1–3 часов. Комиссия платформы — 25%.

Бета: рынок — Россия, пилот в Москве, цены в RUB. Подробности архитектуры,
потоков данных и решений/допущений — в [docs/architecture.md](docs/architecture.md).
Чтобы просто запустить проект — сразу в [docs/SETUP.md](docs/SETUP.md).

## Демо без сервера (GitHub Pages)

Сайт покупателя, мобильная версия (веб-сборка) и кабинет бизнеса можно открыть в браузере без backend и базы: ответы API
подставляет встроенный слой [`packages/demo`](packages/demo) (те же 59 предложений витрины, демо-покупатель, заведение «Кафе Пушкинъ»
с историей продаж). Всё хранится только в браузере посетителя.

- Сборка: `bash scripts/build-demo.sh` → `site/` (страница выбора + `web/`, `mobile/`, `admin/`);
  проверка локально: `python3 qa/qa_demo_pages.py` (поднимает «двойник Pages», открывает три приложения и проходит сценарий заказа).
- Публикация: workflow [`pages.yml`](.github/workflows/pages.yml) выкладывает `site/` на GitHub Pages при пуше в `main` (или вручную).
- Данные витрины берутся из сида: `pnpm --filter @apetite/backend demo:export-seed` обновляет `packages/demo/src/seed-data.ts`.
- Демо-входы: покупатель `user@apetite.ru`, заведение `cafe.pushkin@apetite.ru`, пароль `password123` (только для демо).

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
| Проверка | Живые curl-сценарии ([smoke-test.sh](apps/backend/docs/smoke-test.sh), 53 шт.) + ручная проверка UI в браузере на каждом шаге — не автотесты, см. [docs/SETUP.md](docs/SETUP.md#проверка--тесты) |

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
  SETUP.md        — полный гайд: запуск с нуля, env, сиды, тесты (ШАГ 13)
  BACKLOG.md      — что упрощено и что дальше (ШАГ 14)
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
- `backend` (3000) — с ШАГ 4 это настоящее NestJS API (см. ниже), с ШАГ 12 —
  настоящая прод-сборка (`node dist/main.js`, не `ts-node`), собирается из
  корня монорепо (нужен доступ к `@apetite/shared`).
- `admin` (5173) — с ШАГ 10/11 полноценная панель бизнеса и платформы (см. ниже),
  тоже настоящий прод-билд (Vite → статика в nginx).
- Проверка: `curl http://localhost:3000/health` → `{"status":"ok",...}`,
  `http://localhost:5173` → экран входа admin, `docker compose ps` → все
  контейнеры `healthy`.

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

~~⚠️ Известное упрощение: контейнер backend запускает `ts-node` напрямую~~ —
исправлено в ШАГ 12, см. ниже.

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

### Mobile: разрешения и push-уведомления (ШАГ 9)

Полноценный UX геопермишена (вместо автозапроса на монтировании из ШАГ 7): статус
"не спрошено"/"отклонено"/"заблокировано навсегда"/"выдано", rationale-баннер на
Home/Map с двумя степенями серьёзности по цвету (warning — можно спросить снова,
danger — нужны системные настройки, `Linking.openSettings()`), синхронизация с
`PATCH /users/me/location` при выдаче (питает гео-дайджест из ШАГ 6). Push:
`expo-notifications`, регистрация токена в `POST /notifications/push-token` после
входа, тап по уведомлению — навигация на заказ (`data.orderId`) или на Home.
Новый экран «Уведомления» (значок-колокольчик с бейджем непрочитанных на Home) —
фильтр Все/Непрочитанные, mark-as-read по тапу, `GET /notifications`.

⚠️ Попутно нашёл и починил баг в `apps/backend/src/notifications/dto/list-notifications.query.ts`:
`@Type(() => Boolean)` от class-transformer превращает ЛЮБУЮ непустую строку query-параметра
(включая буквально `"false"`) в `true` — мобильный клиент, который теперь явно шлёт
`unreadOnly=false` для вкладки "Все", получал пустой список вместо всех уведомлений.
Заменено на явный `@Transform`. Регрессия закрыта в smoke-test.sh.

Подробности — в [apps/mobile/README.md](apps/mobile/README.md).

### Admin: панель бизнеса (ШАГ 10)

React + Vite + TypeScript SPA для владельцев заведений — заменяет плейсхолдер из
ШАГ 2. Вход только для роли `BUSINESS`; три экрана: **Офферы** (CRUD на
`GET/POST/PATCH/DELETE /offers`, скидка read-only — считается шедулером ШАГ 5, а не
редактируется вручную), **Заказы** (`GET /orders`, подтверждение выдачи вводом
6-значного pickup-кода прямо в строке таблицы → `PATCH /orders/:id/complete`),
**Аналитика** (новый `GET /businesses/:id/stats` — выручка/комиссия/спасённые кг/
разбивка заказов по статусам для ОДНОГО заведения; кросс-заведенческий GMV платформы
— отдельная сводка ШАГ 11, не здесь).

Docker: `apps/admin/Dockerfile` теперь настоящий multi-stage билд (`context: .` —
как у backend, нужен `@apetite/shared`) вместо nginx-плейсхолдера с одним
`index.html`; `docker-compose.yml`'s `admin`-сервис обновлён под это (build `args`
вместо рантайм `environment` — Vite инлайнит `VITE_API_BASE_URL` на этапе сборки).

⚠️ Попутно нашёл и починил ещё один баг: `GET /businesses/:id/stats` изначально
писал напрямую под живые данные вручную — оказалось, что сид уже кладёт офферы и
заказы на то же заведение (`cafe.pushkin`), так что абсолютные числа в
smoke-test.sh были нестабильны между прогонами. Переписал проверки на дельту
"до/после" вместо абсолютных значений — 45/45 проходят стабильно.

Подробности, известные упрощения (одно заведение на аккаунт, ручной ввод
pickup-кода без QR-сканирования, найденный по пути UI-баг с обрезанной таблицей)
и что проверено вживую — в [apps/admin/README.md](apps/admin/README.md).

### Admin: панель платформы (ШАГ 11)

Тот же `@apetite/admin`, второй раздел — доступен роли `ADMIN` (роль определяет
редирект после входа и видимую навигацию, `RequireRole` в `App.tsx` не даёт
одной роли открыть экраны другой). Два экрана: **Заведения** — модерация
(блокировка/разблокировка через уже существовавший с ШАГ 4 `PATCH
/businesses/:id { status }`, только теперь с UI) и комиссия (новое поле
`commissionPercent` в `UpdateBusinessDto`, редактируется инлайн в таблице,
backend молча игнорирует его для не-ADMIN — та же защита, что уже была у
`status`), плюс кнопка онбординга нового заведения поверх уже существовавшего
`POST /businesses` (тоже был без UI с ШАГ 4). **GMV** — новый `GET /platform/stats`:
суммарная выручка и доход платформы по `COMPLETED`-заказам ВСЕХ заведений сразу
(в отличие от per-business сводки ШАГ 10), плюс разбивка заведений/заказов по
статусам. Список заведений с прикреплённой сводкой заказов — новый
`GET /platform/businesses` (одним запросом, не гоняя список + N сводок).

Подробности и что проверено вживую (включая кросс-проверку: GMV платформы
совпал с суммой per-business аналитики единственного заведения с реальными
заказами) — в [apps/admin/README.md](apps/admin/README.md).

### Прод-сборка backend (ШАГ 12)

`apps/backend/Dockerfile` больше не запускает `ts-node` в контейнере — теперь
настоящая multi-stage сборка: `tsc` компилирует и `@apetite/shared`, и сам
backend в `dist/`, затем `pnpm deploy --prod` собирает самодостаточную папку
только с прод-зависимостями (workspace-протокол резолвится из уже собранного
`dist`, а не symlink на исходники монорепо — штатный механизм pnpm для именно
этого сценария), и финальный слой — `node:22-alpine` с `CMD ["node", "dist/main.js"]`.
`apps/backend/package.json`'s `start` script теперь и означает именно это
(раньше — по имени "start", а по факту `ts-node src/main.ts`).

⚠️ По пути нашёл и исправил три реальных проблемы, не выдуманные — каждая
воспроизводилась при живой сборке `docker build`, не в теории:
- **`@apetite/shared` собирался как CommonJS-only**, и Vite/Rollup (production
  `vite build` для admin, ШАГ 10) не мог статически определить именованные
  экспорты через паттерн `export * from` в CJS-барреле (особенно ломался на
  TS `enum`, компилирующемся в самоссылающийся IIFE) — `vite build` падал с
  "OfferCategory is not exported". Собираю `@apetite/shared` в двух форматах
  (`dist/cjs` и `dist/esm`, `package.json` → `exports` с условиями
  `require`/`import`) — backend требует CJS через `require`, Vite/Metro берут
  ESM с настоящими статическими экспортами.
- **`pnpm deploy --prod` переустанавливает `node_modules` с нуля**, и
  `@prisma/client`'s postinstall срабатывает без Prisma CLI (devDependency, в
  `--prod` не попадает) — тихо создаёт generic-клиент без наших моделей/enum'ов
  вместо настоящего. Перегенерирую явно (`pnpm dlx prisma@<версия> generate`,
  версия закреплена — иначе `dlx` берёт `latest`, а это на момент написания
  нестабильный `8.0.0-rc` с другим CLI, без команды `generate`).
- **`docker-compose.yml` по умолчанию ставил `NODE_ENV=development`** для
  backend-контейнера — с реальной прод-сборкой это крашилось: `pino-pretty`
  (dev-логи) корректно исключён из prod-зависимостей, но код всё ещё пытался
  его подключить при `NODE_ENV !== "production"`. Контейнер теперь по
  умолчанию `production` независимо от общего `.env` (который остаётся
  `development` для локальных `pnpm dev:*` вне Docker) — см. `.env.example`.
- **`apps/admin/Dockerfile`'s HEALTHCHECK был сломан с самого ШАГ 10**, просто
  никто не проверял полный `docker compose up` до этого шага: busybox `wget`
  внутри образа резолвит `localhost` в IPv6 (`::1`) первым, а nginx слушает
  только IPv4 — контейнер стабильно отвечал на реальные запросы, но healthcheck
  всегда падал с "connection refused" и Docker помечал его `unhealthy`.
  Заменил на явный `http://127.0.0.1/`.

Заодно удалил `apps/backend/server.js` — забытая nginx-эпохи заглушка из
ШАГ 2, ничем не используемая с ШАГ 4.

`docker compose build` для admin тоже обновлён (явный шаг сборки
`@apetite/shared` перед `vite build` — раньше резолвился напрямую в исходники,
теперь только через `dist/`). Полный стек (`postgres`+`redis`+`backend`+`admin`
все в Docker, все четыре контейнера `healthy`) проверен вживую с нуля — чистая
пересборка, 53/53 smoke-тестов, живой вход в admin через браузер и работающий
mobile-web поверх того же контейнеризированного backend.

### Полный гайд по запуску (ШАГ 13)

Разделы выше по каждому шагу рассказывают, *что* было построено и почему —
для *как запустить с нуля* теперь есть один линейный гайд:
**[docs/SETUP.md](docs/SETUP.md)** — требования, установка, три способа
запуска (гибрид с Docker только под инфраструктуру — рекомендуется для
разработки; всё в Docker; локально без Docker — не тестировался), полный
разбор переменных окружения по всем трём `.env.example`, сиды с таблицей
демо-аккаунтов, что реально используется для проверки (53 живых
smoke-сценария + `pnpm lint` + ручная проверка UI — юнит-тестов в проекте нет,
решение по факту не понадобилось) и частые проблемы при первом запуске.

Каждая команда из гайда прогнана вживую перед публикацией — не переписана с
чужих слов.

## Резервные копии рабочего дерева

Перед большими переделками (например, интерфейса) можно сохранить снимок **всего, что не в `.gitignore`** — изменённое, новое и
незакоммиченное — без коммита в вашу ветку и без изменения рабочих файлов. Снимок хранится как скрытая ссылка git
`refs/backups/<имя>` и как переносимый архив `../appetite-backups/<имя>.tar.gz` (переживёт и потерю `.git`). Папка `img/` не входит.

```bash
pnpm backup create before-redesign      # сделать снимок
pnpm backup list                        # показать снимки
pnpm backup diff before-redesign        # что изменилось с тех пор
pnpm backup restore before-redesign     # вернуть файлы (перед этим автоматически сохраняется «как сейчас»)
pnpm backup restore before-redesign --prune   # то же + удалить файлы, созданные после снимка
pnpm backup delete before-redesign
```

Тестовый показ новых элементов интерфейса — экран `/ui-lab` в dev-сборке мобильного web (`http://localhost:8081/ui-lab`, вход не нужен);
в production-сборку он не попадает. Проверка: `python3 qa/qa_mobile_lab.py`.

## Статус

Бета готова: все 15 шагов плана (ШАГ 0…ШАГ 14) выполнены — mobile, backend,
панель бизнеса и панель платформы работают вместе, живьём проверены,
53/53 smoke-тестов проходят. Архитектурные решения — в
[docs/architecture.md](docs/architecture.md); как запустить — в
[docs/SETUP.md](docs/SETUP.md); что сознательно упрощено и что стоит сделать
перед реальным (не пилотным) запуском — в **[docs/BACKLOG.md](docs/BACKLOG.md)**
(ШАГ 14, последний шаг плана — не новый код, инвентаризация решений ШАГ 0 и
упрощений по пути, чтобы они не потерялись в истории коммитов).

## Лицензия

Proprietary — см. [LICENSE](LICENSE).
