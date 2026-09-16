# @apetite/mobile

Expo + React Native + TypeScript — каркас мобильного приложения (ШАГ 7).

## Стек

- **Expo SDK 57** (React Native 0.86, React 19) — версии подобраны `expo install`,
  гарантированно совместимы друг с другом.
- **React Navigation v7** — native-stack (Auth-стек, root-стек с OfferDetail/Checkout)
  + bottom-tabs (Home/Map/Orders/EcoProfile/Profile).
- **Zustand** — стейт-менеджмент (`useAuthStore` — токены, текущий пользователь).
- **react-i18next** + `expo-localization` — RU/EN, автоопределение языка устройства
  с фолбэком на RU (`DEFAULT_LOCALE` из `@apetite/shared`).
- **expo-secure-store** (iOS/Android) / **AsyncStorage** (web) — хранение
  access/refresh токенов, платформенно-специфичный выбор в `store/tokenStorage.ts`.
- Собственная лёгкая тема (`theme/tokens.ts`) — светлая/тёмная по `useColorScheme()`,
  прокинута и в React Navigation (`theme/navigationTheme.ts`), чтобы хедеры/таб-бар
  тоже темизировались, а не только экраны.

## Структура

```
src/
  api/          — fetch-клиент (JWT, авто-refresh на 401) + по модулю на backend-ресурс
  store/        — authStore (zustand) + абстракция secure-хранилища токенов
  theme/        — токены темы, ThemeProvider, тема для React Navigation
  i18n/         — react-i18next + locales/{ru,en}.json
  navigation/   — RootNavigator (Auth vs Main), AuthNavigator, MainTabNavigator, types.ts
  screens/      — auth, home, map, offer-detail, checkout, orders, profile, eco-profile
  components/   — Screen, Button, TextField, StateViews (Loading/Empty/Error)
```

## Что реально работает в ШАГ 7 (не заглушка)

- Полный цикл auth: регистрация/вход/refresh-по-401/logout против настоящего backend.
- Токены переживают перезагрузку страницы/приложения (secure storage + hydrate при старте).
- Home — реальный список офферов (`GET /offers`), OfferDetail — реальная карточка
  (`GET /offers/:id`), Orders — реальный список заказов пользователя.
- Навигация между табами и вглубь стека (Home → OfferDetail → Checkout) с типизированными
  параметрами маршрутов.
- Profile показывает данные текущего пользователя и разлогинивает по-настоящему.

## Что оставлено заглушкой до ШАГ 8

Map, Checkout (оплата/QR) и EcoProfile — по плану это «основной сценарий», не каркас.
Экраны рендерятся, навигация до них работает, внутри — текст "Coming in Step 8".

## Быстрый старт

```bash
cp .env.example .env   # EXPO_PUBLIC_API_BASE_URL — на физическом устройстве заменить
                        # localhost на IP компьютера в локальной сети
pnpm dev:mobile         # интерактивный Expo CLI: w — web, i — iOS, a — Android
```

Backend должен быть поднят (`docker compose up -d` или `pnpm dev:backend`) — без него
Auth/Home/Orders не смогут ничего загрузить (ошибка сети, не краш приложения).

⚠️ Известное упрощение: на web `expo-secure-store` не поддерживается, поэтому там токены
хранятся в `AsyncStorage` (по факту — localStorage), менее безопасно, чем на нативе;
это ожидаемо для dev/web-предпросмотра, не для прод-мобильного билда.

## Проверка (сделана вживую, не только тестами)

Прогнано через Expo web в браузере против реального backend: логин, hard reload с
сохранением сессии, обход всех 5 табов, переход Home → OfferDetail → Checkout с
передачей `offerId`, logout, полный цикл регистрации нового пользователя с авто-входом.
