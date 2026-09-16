# Собирается из корня монорепо (docker-compose: context: .) — нужен доступ
# к pnpm workspace и исходникам @apetite/shared, от которого backend зависит.
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# Сначала только манифесты — слой install переиспользуется, пока зависимости не менялись.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/backend apps/backend

WORKDIR /repo/apps/backend
RUN pnpm run prisma:generate

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O - http://localhost:3000/health || exit 1

# Прод-сборка через tsc (pnpm build/start) — не подключена начиная с ШАГ 4, см. README:
# ts-node в контейнере проще и не требует компилировать @apetite/shared в JS. Вернёмся
# к сборке dist/ при реальной оптимизации перед пилотом (ШАГ 13+).
CMD ["pnpm", "run", "start"]
