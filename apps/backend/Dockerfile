# Собирается из корня монорепо (docker-compose: context: .) — нужен доступ
# к pnpm workspace и исходникам @apetite/shared, от которого backend зависит.
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# Сначала только манифесты — слой install переиспользуется, пока зависимости не менялись.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/backend apps/backend

# @apetite/shared собирается в JS до сборки backend — backend.tsc проверяет типы
# против dist/*.d.ts (package.json shared указывает на dist, не на src, см. ШАГ 12).
RUN pnpm --filter @apetite/shared run build

WORKDIR /repo/apps/backend
RUN pnpm run prisma:generate
RUN pnpm run build

# `pnpm deploy` — штатный механизм pnpm для monorepo: собирает самодостаточную папку
# с prod-зависимостями конкретного пакета (workspace:*-зависимости резолвятся как
# обычные, из уже собранного dist, а не symlink на исходники монорепо).
WORKDIR /repo
RUN pnpm --filter @apetite/backend deploy --prod /deploy/backend

# `pnpm deploy --prod` ставит зависимости с нуля — postinstall @prisma/client
# срабатывает без Prisma CLI (это devDependency, в --prod не попадает) и молча
# создаёт generic-клиент без наших моделей/enum'ов. Перегенерируем осознанно —
# pnpm dlx подтягивает CLI временно, не добавляя его в prod-образ. Версия
# закреплена — иначе dlx берёт latest (на момент написания это нестабильный
# 8.0.0-rc с другим CLI, без команды generate) вместо той, что реально стоит.
WORKDIR /deploy/backend
RUN pnpm dlx prisma@6.19.3 generate

FROM node:22-alpine
WORKDIR /app
COPY --from=build /deploy/backend ./

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O - http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
