# Собирается из корня монорепо (docker-compose: context: .) — нужен доступ к pnpm
# workspace и исходникам @apetite/shared, от которого admin зависит (как и backend).
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/admin apps/admin

# @apetite/shared указывает на dist/, не на src/ (ШАГ 12) — собрать явно перед
# tsc/vite, иначе резолвинг пакета в build-стадии ничего не найдёт.
RUN pnpm --filter @apetite/shared run build

WORKDIR /repo/apps/admin
# Vite инлайнит VITE_-переменные в бандл на этапе сборки (как Expo с EXPO_PUBLIC_) —
# в отличие от backend, рантайм-ENV контейнера на уже собранный статический бандл не влияет.
ARG VITE_API_BASE_URL=http://localhost:3000/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm run build

FROM nginx:alpine
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
# 127.0.0.1, не localhost — busybox wget в этом образе резолвит localhost в IPv6 (::1)
# первым, а nginx слушает только IPv4; healthcheck иначе всегда FAIL, хотя сервер отвечает.
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O - http://127.0.0.1/ || exit 1
