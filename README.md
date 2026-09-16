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
Offer, Order, EcoTransaction, Notification). После `db:seed` в базе:
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

**Проверка** (curl-коллекция + Postman):
```bash
pnpm dev:backend &                          # или docker compose up -d
bash apps/backend/docs/smoke-test.sh        # 15 сценариев, включая права доступа и оверселл
```
Postman-коллекция — [apps/backend/docs/apetite-backend.postman_collection.json](apps/backend/docs/apetite-backend.postman_collection.json)
(импортировать и прогонять запросы по порядку сверху вниз, токены/id сохраняются
в переменные коллекции автоматически).

⚠️ Известное упрощение: контейнер backend запускает `ts-node` напрямую (не
компилирует в `dist/`), т.к. `@apetite/shared` подключён как TS-исходники —
компилируемая прод-сборка (`pnpm build`) осталась для более поздней оптимизации
(ШАГ 12–13). Эко-баллы после самовывоза, mock-платежи, генерация QR-картинки,
`/offers/nearby` с гео и cron пересчёта скидок — бизнес-логика ШАГ 5.

Дальше (появится в следующих шагах):
- `pnpm dev:admin` / `pnpm dev:mobile` — запуск admin/mobile в dev-режиме (ШАГ 7/10).

Полный гайд по запуску, переменным окружения, сидам и тестам будет собран в
**ШАГ 13** — сейчас справочно смотри [.env.example](.env.example).

## Статус

Проект в разработке пошагово (ШАГ 0…ШАГ 14). Текущий прогресс и допущения по
продукту — см. план шага 0 и архитектурные решения в
[docs/architecture.md](docs/architecture.md).

## Лицензия

Proprietary — см. [LICENSE](LICENSE).
