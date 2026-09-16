# Настройка и запуск

Полный гайд: с нуля до работающего стека (backend + admin + mobile-web) на
локальной машине, плюс переменные окружения, сиды и способы проверки. Для
архитектуры и потоков данных — [architecture.md](architecture.md); для истории
решений по каждому шагу — [корневой README](../README.md).

## Требования

- **Node.js ≥ 20** (движок для pnpm/Expo/NestJS).
- **pnpm 9.12.0** — через corepack, не нужно ставить отдельно:
  ```bash
  corepack enable
  corepack prepare pnpm@9.12.0 --activate
  ```
- **Docker + Docker Compose** — для PostgreSQL/Redis (обязательно) и опционально
  для полного стека в контейнерах.

## Установка

```bash
git clone <repo>
cd appetite
pnpm install
cp .env.example .env
```

`@apetite/shared`'s `package.json` указывает `main`/`types` на `dist/`, не на
`src/` (ШАГ 12) — собрать его нужно явно, `pnpm install` это не делает сам
(намеренно: root `postinstall` ломал бы Docker-кэширование слоя install, см.
[корневой README](../README.md#прод-сборка-backend-шаг-12)):

```bash
pnpm build:shared
```

Без этого шага backend/admin/mobile не найдут `@apetite/shared/dist` при
первом запуске. Нужно повторять после любых правок в `packages/shared/src`.

## Переменные окружения

Три `.env.example`-файла — один общий (корень, читают backend и docker-compose)
и два для web-клиентов, которые инлайнят переменные в бандл на этапе сборки, не
рантайма (Vite/`VITE_`-префикс, Expo/`EXPO_PUBLIC_`-префикс):

| Файл | Кто читает | Когда нужно менять |
|---|---|---|
| [.env.example](../.env.example) | `docker-compose.yml`, `apps/backend` (через `dotenv`, см. `src/load-env.ts`) | почти никогда для локальной разработки — дефолты рабочие из коробки |
| [apps/mobile/.env.example](../apps/mobile/.env.example) | Metro (Expo) при сборке | `EXPO_PUBLIC_API_BASE_URL` → IP компьютера в локальной сети при тесте с физического устройства (не `localhost`) |
| [apps/admin/.env.example](../apps/admin/.env.example) | Vite при сборке | `VITE_API_BASE_URL`, если backend не на `localhost:3000` |

Скопировать по необходимости:

```bash
cp apps/mobile/.env.example apps/mobile/.env   # только для pnpm dev:mobile
cp apps/admin/.env.example apps/admin/.env     # только для pnpm dev:admin
```

Ключевые группы переменных корневого `.env` (полный список с дефолтами — сам
файл, он короткий и с комментариями):

- **PostgreSQL/Redis** — `POSTGRES_*`, `REDIS_*`, плюс собранные `DATABASE_URL`/`REDIS_URL`.
- **Auth** — `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (обязательно сменить перед
  реальным деплоем — дефолты `change-me-*` только для dev), TTL токенов.
- **Платежи/push** — `PAYMENT_PROVIDER=mock`, `EXPO_PUSH_MODE=mock` — реальные
  провайдеры подключаются заменой класса за интерфейсом (`PaymentProvider`/
  `PushProvider`), без изменений в бизнес-логике.
- **Платформенные константы** — `PLATFORM_COMMISSION_PERCENT` (дефолт для новых
  заведений — переопределяется по заведению из ШАГ 11), `PICKUP_CODE_LENGTH`,
  `DISCOUNT_CRON_EXPRESSION`.
- **`NODE_ENV`** — влияет только на локальные `pnpm dev:*` вне Docker; backend-
  контейнер всегда стартует в `production` независимо от этого значения (ШАГ 12,
  переопределяется отдельной `BACKEND_NODE_ENV`, если действительно нужно).

## Способы запуска

### Вариант 1 — гибрид: инфра в Docker, приложения локально (рекомендуется для разработки)

Быстрее всего для итерации — hot-reload у backend/admin/mobile, без пересборки
Docker-образов на каждое изменение.

```bash
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed

# в отдельных терминалах:
pnpm dev:backend    # NestJS, ts-node-dev, localhost:3000
pnpm dev:admin      # Vite dev server, localhost:5173
pnpm dev:mobile     # Expo CLI — нажать w для web, i/a для iOS/Android
```

### Вариант 2 — всё в Docker (ближе к проду)

```bash
docker compose up -d --build
pnpm db:migrate     # образ сам миграции не применяет при старте — прогнать вручную
pnpm db:seed
```

`admin` — `http://localhost:5173`, `backend` — `http://localhost:3000`. Mobile
в Docker не запускается (Expo-приложения не контейнеризируются для веба таким
образом) — для mobile-web всё равно нужен `pnpm dev:mobile`, указывающий
`EXPO_PUBLIC_API_BASE_URL` на контейнеризированный backend (дефолт
`localhost:3000` уже подходит).

Проверка: `curl http://localhost:3000/health` → `{"status":"ok",...}`,
`docker compose ps` → все контейнеры `healthy` (см. ШАГ 12 про два бага с
healthcheck'ами, которые это раньше маскировали).

### Вариант 3 — полностью локально, без Docker

Не тестировался и не документируется отдельно — потребует свои PostgreSQL 16 и
Redis 7, вручную настроенные под переменные из `.env`. Вариант 1 с Docker только
под инфраструктуру достаточно быстрый, чтобы не было практической причины так делать.

## База данных

```bash
pnpm db:migrate    # применить миграции (создаёт схему)
pnpm db:seed       # тестовые данные — идемпотентно, можно гонять повторно
pnpm db:studio     # Prisma Studio — визуальный просмотр localhost:5555
```

После `db:seed` в базе (все пароли — `password123`):

| Аккаунт | Роль | Что там есть |
|---|---|---|
| `admin@apetite.ru` | ADMIN | доступ в панель платформы (ШАГ 11) |
| `user@apetite.ru` | USER | один завершённый заказ (с EcoTransaction), один активный (CONFIRMED) |
| `cafe.pushkin@apetite.ru` | BUSINESS | заведение «Кафе Пушкинъ», категория FOOD, с офферами |
| `bulka.arbat@apetite.ru`, `flowers.mos@apetite.ru`, `market.svezhest@apetite.ru` | BUSINESS | ещё 3 заведения, по одному на остальные категории |

5 активных офферов с разным временем до `pickupEnd` — демонстрируют все уровни
скидки шедулера (50/60/70%).

## Проверка / тесты

В проекте нет юнит-тестов (Jest не подключён, несмотря на раннюю пометку в
стеке — решение по факту не понадобилось: REST-контракты и бизнес-правила
проще и надёжнее проверяются живыми запросами против реальной БД, а UI —
живым просмотром в браузере; ниже — что реально используется на каждом шаге).

**Backend — 53 живых сценария (curl, не моки):**

```bash
docker compose up -d postgres redis
pnpm db:migrate && pnpm db:seed
pnpm dev:backend   # или собранный прод-образ — оба варианта покрыты
bash apps/backend/docs/smoke-test.sh
```

Покрывает auth, CRUD, права доступа по ролям, гео-поиск, mock-оплату + вебхук,
шедулер скидок, push/уведомления/гео-дайджест, эко-баллы, платформенную
статистику (ШАГ 10–11) — по одной секции на шаг, с комментарием, что именно
проверяется. Использует delta-сравнения там, где сиды уже кладут данные на то
же заведение (см. ШАГ 10).

Postman-коллекция для ручного/exploratory тестирования —
[apps/backend/docs/apetite-backend.postman_collection.json](../apps/backend/docs/apetite-backend.postman_collection.json).

**Типы — единый гейт корректности по всем пакетам:**

```bash
pnpm lint   # tsc --noEmit в packages/shared + apps/backend + apps/admin + apps/mobile
```

**Mobile и admin — вживую в браузере**, не автотестами: каждый ШАГ (7–11)
заканчивался реальным прогоном через Expo web / собранный admin в браузере
против настоящего backend, задокументированным в разделах «Проверено вживую»
[apps/mobile/README.md](../apps/mobile/README.md) и
[apps/admin/README.md](../apps/admin/README.md). Известное ограничение этого
подхода — built-in browser tool окружения разработки намеренно подавляет
нативные `confirm()`/`alert()` диалоги, поэтому пара действий (отмена заказа,
блокировка заведения) верифицирована прямым `curl`-запросом вместо клика
"да" в диалоге; сам факт, что нужный запрос уходит и что UI корректно
обновляется после релоада, проверен визуально.

## Типичные проблемы

- **"Failed to fetch" из браузера (mobile-web/admin)** — backend не поднят, или
  CORS (маловероятно — `app.enableCors()` открыт широко) — проверить
  `curl http://localhost:3000/health`.
- **Порт уже занят** — 3000 (backend), 5173 (admin), 8081 (mobile web), 5432
  (postgres), 6379 (redis) — проверить `lsof -nP -iTCP:<port> -sTCP:LISTEN`.
- **`@apetite/shared` не резолвится / старые типы** — пересобрать:
  `pnpm build:shared` (нужно после `pnpm install` и после любых правок в
  `packages/shared/src`, см. ШАГ 12 — `main`/`types` указывают на `dist/`, не
  на `src/`).
- **Prisma-клиент не соответствует схеме** — `pnpm --filter @apetite/backend prisma:generate`.
- **`docker compose up` — контейнер `unhealthy`, но отвечает на запросы** —
  известный класс багов из ШАГ 12 (IPv6/IPv4 у nginx healthcheck) — уже
  исправлен для `admin`; если всплывёт похожее у нового сервиса, смотри туда
  за паттерном исправления.
