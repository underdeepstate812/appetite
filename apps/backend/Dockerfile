# Плейсхолдер-образ backend для ШАГ 2 (проверка сети Docker Compose).
# Будет заменён на полноценную сборку NestJS-приложения в ШАГ 4.
FROM node:22-alpine
WORKDIR /app
COPY server.js ./
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O - http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
