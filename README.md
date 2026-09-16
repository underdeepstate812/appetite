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
- `backend` (3000) и `admin` (5173) — **плейсхолдеры** (простой health-эндпоинт /
  статичная страница) только для проверки сети и docker-compose-обвязки. Реальные
  приложения появятся в ШАГ 4 (backend) и ШАГ 10 (admin) и заменят Dockerfile'ы —
  до этого `pnpm dev:backend` / `pnpm dev:admin` работать не будут.
- Проверка: `curl http://localhost:3000/health` → `{"status":"ok",...}`,
  `http://localhost:5173` → страница-плейсхолдер admin.

Дальше (появится в следующих шагах):
- `pnpm db:migrate` + `pnpm db:seed` — миграции и сиды Prisma (ШАГ 3, сейчас упадут:
  `@apetite/backend` ещё не существует как пакет).
- `pnpm dev:backend` / `pnpm dev:admin` / `pnpm dev:mobile` — запуск приложений в dev-режиме.

Полный гайд по запуску, переменным окружения, сидам и тестам будет собран в
**ШАГ 13** — сейчас справочно смотри [.env.example](.env.example).

## Статус

Проект в разработке пошагово (ШАГ 0…ШАГ 14). Текущий прогресс и допущения по
продукту — см. план шага 0 и архитектурные решения в
[docs/architecture.md](docs/architecture.md).

## Лицензия

Proprietary — см. [LICENSE](LICENSE).
