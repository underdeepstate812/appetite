# Плейсхолдер-образ admin для ШАГ 2 (проверка сети Docker Compose).
# Будет заменён на полноценную сборку React + Vite приложения в ШАГ 10.
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O - http://localhost/ || exit 1
