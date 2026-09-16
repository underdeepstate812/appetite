# @apetite/backend

NestJS + TypeScript API. Ядро (auth, CRUD Business/Offer/Order) — ШАГ 4,
бизнес-логика (гео-поиск, mock-оплата, шедулер скидок) — ШАГ 5, уведомления —
ШАГ 6, эко-профиль — ШАГ 8, платформенная сводка — ШАГ 10–11, прод-сборка —
ШАГ 12. Подробности по каждому шагу — в [корневом README](../../README.md).

## Стек

NestJS 11, Prisma (PostgreSQL), Redis (задел, backend его пока не использует
напрямую — гео-поиск читает Postgres напрямую, см. [docs/architecture.md](../../docs/architecture.md)),
JWT (access + refresh), class-validator/class-transformer, `@nestjs/schedule`
(единый крон на скидки + уведомления), pino (структурные JSON-логи), mock-провайдеры
платежей и Expo push за интерфейсами (`PaymentProvider`/`PushProvider`), готовые к
замене на реальные без изменений в бизнес-логике.

## Структура

```
src/
  auth/           — регистрация/вход/refresh/logout/me, JWT-стратегии, guard'ы
  common/         — guards (JwtAuthGuard, RolesGuard), декораторы, фильтр ошибок
  config/         — валидация env (Joi)
  businesses/     — CRUD заведений, онбординг (ADMIN), сводка (ШАГ 10)
  offers/         — CRUD офферов, публичный список/поиск
  orders/         — покупка, QR, отмена, подтверждение выдачи по pickupCode
  payments/       — mock-провайдер + вебхук с HMAC-подписью
  scheduler/      — пересчёт скидок каждые 15 минут (единый крон)
  notifications/  — push-токены, гео-дайджест, напоминания за 30 минут
  users/          — геопозиция пользователя (для гео-дайджеста)
  eco/            — сводка эко-баллов/уровня (ШАГ 8)
  platform/       — платформенная сводка: GMV, комиссия (ШАГ 11)
  prisma/         — PrismaService (DI-обёртка над PrismaClient)
prisma/
  schema.prisma   — модели, миграции, seed.ts (сид-данные для разработки)
docs/
  smoke-test.sh                        — 53 живых curl-сценария поверх сидов
  apetite-backend.postman_collection.json
```

## Быстрый старт

```bash
docker compose up -d postgres redis   # или локальные инстансы
cp ../../.env.example ../../.env      # корневой .env — backend его и читает
pnpm prisma:migrate                   # применить миграции
pnpm prisma:seed                      # тестовые пользователи/заведения/офферы
pnpm dev                              # ts-node-dev, hot-reload, localhost:3000
```

Демо-доступ после сида: `admin@apetite.ru`, `user@apetite.ru`,
`cafe.pushkin@apetite.ru` (+ 3 других заведения) — все `password123`.

## Прод-сборка (ШАГ 12)

`Dockerfile` — multi-stage: компилирует `@apetite/shared` и сам backend в
`dist/`, затем `pnpm deploy --prod` собирает самодостаточную папку только с
прод-зависимостями, финальный образ — `node:22-alpine` с
`CMD ["node", "dist/main.js"]` (никакого `ts-node` в контейнере). Локально то
же самое: `pnpm build && pnpm start`. Подробности и три реальных бага,
найденных при живой сборке (dual CJS/ESM у `@apetite/shared`, перегенерация
Prisma-клиента после `pnpm deploy`, `NODE_ENV` по умолчанию) — в
[корневом README](../../README.md#прод-сборка-backend-шаг-12).

## Проверка

```bash
docker compose up -d postgres redis
pnpm prisma:migrate && pnpm prisma:seed
pnpm dev                                    # или pnpm build && pnpm start
bash docs/smoke-test.sh                     # 53 сценария, живые curl-запросы
```

Postman-коллекция — [docs/apetite-backend.postman_collection.json](docs/apetite-backend.postman_collection.json).
