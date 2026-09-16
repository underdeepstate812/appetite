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

## Быстрый старт (появится по мере готовности шагов)

Пакетный менеджер — **pnpm** (workspaces). Если pnpm не установлен:

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
```

Установка зависимостей монорепозитория:

```bash
pnpm install
```

Дальше (появится в соответствующих шагах):
- `docker compose up` — поднимет PostgreSQL, Redis, backend, admin (ШАГ 2).
- `pnpm --filter @apetite/backend prisma migrate dev` + `prisma db seed` (ШАГ 3).
- `pnpm dev:backend` / `pnpm dev:admin` / `pnpm dev:mobile` — запуск отдельных приложений.

Полный гайд по запуску, переменным окружения, сидам и тестам будет собран в
**ШАГ 13** — сейчас справочно смотри [.env.example](.env.example).

## Статус

Проект в разработке пошагово (ШАГ 0…ШАГ 14). Текущий прогресс и допущения по
продукту — см. план шага 0 и архитектурные решения в
[docs/architecture.md](docs/architecture.md).

## Лицензия

Proprietary — см. [LICENSE](LICENSE).
