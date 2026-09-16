# @apetite/mobile

Expo + React Native + TypeScript. Каркас — ШАГ 7, основной сценарий — ШАГ 8.

## Стек

- **Expo SDK 57** (React Native 0.86, React 19) — версии подобраны `expo install`,
  гарантированно совместимы друг с другом.
- **React Navigation v7** — native-stack (Auth-стек, root-стек с OfferDetail/Checkout/
  OrderConfirmation/OrderDetail) + bottom-tabs (Home/Map/Orders/EcoProfile/Profile).
- **Zustand** — стейт-менеджмент (`useAuthStore` — токены, текущий пользователь).
- **react-i18next** + `expo-localization` — RU/EN, автоопределение языка устройства
  с фолбэком на RU (`DEFAULT_LOCALE` из `@apetite/shared`).
- **expo-location** — геопозиция для nearby-поиска (минимальный флоу без rationale-экрана,
  полноценный UX разрешений — ШАГ 9).
- **react-native-maps** — карта на native; на web у библиотеки нет реализации (её
  `MapView.web.ts` — пустая заглушка `UnimplementedView`), поэтому `MapScreen.web.tsx` —
  честный фолбэк: тот же список, отсортированный по расстоянию.
- **expo-secure-store** (iOS/Android) / **AsyncStorage** (web) — хранение
  access/refresh токенов, платформенно-специфичный выбор в `store/tokenStorage.ts`.
- Собственная лёгкая тема (`theme/tokens.ts`) — светлая/тёмная, с ручным
  переключателем System/Light/Dark в Profile (`store/themeStore.ts`, zustand +
  persist в AsyncStorage) поверх системной `useColorScheme()`; прокинута и в
  React Navigation (`theme/navigationTheme.ts`), чтобы хедеры/таб-бар тоже
  темизировались, а не только экраны. В палитре — soft-tint варианты акцентных
  цветов (`primarySoft`/`successSoft`/`warningSoft`/`dangerSoft`) для фоновых
  плашек/бейджей, отдельные от насыщенных цветов текста/иконок поверх них.

## Структура

```
src/
  api/          — fetch-клиент (JWT, авто-refresh на 401) + по модулю на backend-ресурс
  store/        — authStore (zustand) + абстракция secure-хранилища токенов
  hooks/        — useLocation, useNearbyOffers, useNow (тик для countdown)
  theme/        — токены темы, ThemeProvider, тема для React Navigation
  i18n/         — react-i18next + locales/{ru,en}.json
  navigation/   — RootNavigator (Auth vs Main), AuthNavigator, MainTabNavigator, types.ts
  screens/      — auth, home, map (.native/.web), offer-detail, checkout,
                  order-confirmation, order-detail, orders, profile, eco-profile
  components/   — Screen, Button, TextField, StateViews, OfferCard, CountdownBadge,
                  SegmentedControl, CategoryFilterBar, OrderStatusTimeline
  utils/        — time.ts (countdown), confirm.ts (кроссплатформенный confirm-диалог)
```

## Полный сценарий (ШАГ 8) — реально работает, не заглушка

- **Home**: переключатель «Сейчас» (pickupStart уже наступил) / «Вечерние» (начнётся
  позже сегодня), фильтр по категории, реальный гео-поиск (`GET /offers/nearby`) с
  фолбэком на центр Москвы, если геопермишен не выдан/недоступен (типично для web-превью).
- **Карточка оффера**: countdown до `pickupEnd` с цветовой индикацией (<1ч — красный,
  1–2ч — оранжевый, тикает раз в 30 сек через `useNow`), остаток, скидка, дистанция.
- **Checkout → оплата (mock) → подтверждение с QR**: `POST /orders` → `qrCodeDataUrl` +
  `pickupCode` на отдельном экране (`navigation.replace`, чтобы "назад" не возвращал
  на форму оплаты; "Готово" делает `reset()` стека на вкладку Orders).
- **Мои заказы**: список со статусами (`useFocusEffect` — обновляется при каждом
  возврате на экран), деталь заказа — QR повторно + отмена (`PATCH /orders/:id/cancel`).
- **Таймлайн выдачи** (`OrderStatusTimeline`, на экранах подтверждения заказа и деталей
  заказа): 3 стадии — Оплачено → Готовится → Можно забирать, стадия вычисляется на
  клиенте из `pickupStart`/`pickupEnd` (у `Order.status` нет отдельных статусов на эти
  промежуточные состояния). На стадии "можно забирать" — пульсирующая анимация круга
  (`Animated.loop`, только `transform: scale` + `useNativeDriver: true`, без просадки
  кадров ни на native, ни на web) и зелёная soft-tint плашка с временем до конца окна
  самовывоза.
- **Эко-профиль**: реальные баллы/кг/уровень с `GET /eco/me` (новый backend-эндпоинт,
  см. ниже) — прогресс-бар до следующего уровня, из четырёх (Новичок → Спасатель еды →
  Герой планеты → Легенда Apetite).
- **Карта**: на native — `react-native-maps` с маркерами (не проверено вживую — нет
  iOS/Android-симулятора в этом окружении); на web — список по расстоянию с честной
  пометкой, что интерактивная карта доступна в мобильном приложении.

## Быстрый старт

```bash
cp .env.example .env   # EXPO_PUBLIC_API_BASE_URL — на физическом устройстве заменить
                        # localhost на IP компьютера в локальной сети
pnpm dev:mobile         # интерактивный Expo CLI: w — web, i — iOS, a — Android
```

Backend должен быть поднят (`docker compose up -d` или `pnpm dev:backend`) — без него
экраны с данными не смогут ничего загрузить (ошибка сети, не краш приложения).

## Известные упрощения

- На web `expo-secure-store` не поддерживается → токены в `AsyncStorage` (по факту
  localStorage), менее безопасно, чем на нативе; ожидаемо для dev/web-предпросмотра.
- Количество в заказе всегда 1 (как "сюрприз-пакет" в TGTG) — без степпера.
- `react-native-web`'s `Alert.alert()` — пустая заглушка (колбэки не срабатывают),
  поэтому подтверждение отмены заказа — через `utils/confirm.ts`
  (`window.confirm` на web, `Alert.alert` на native), а не напрямую `Alert.alert`.
- Гео — минимальный флоу (`useLocation`): запрос пермишена + фолбэк на центр Москвы,
  без rationale-экрана и обработки "запретил навсегда" — это ШАГ 9.
- Карта на native (`MapScreen.native.tsx`) не проверена вживую — нет симулятора в
  этом окружении. Код написан по документированному API `react-native-maps`
  (проверил сигнатуры типов перед использованием), но нуждается в проверке на
  реальном устройстве/симуляторе.

## Проверка (сделана вживую, не только тестами)

Прогнано через Expo web в браузере против реального backend, полный путь от входа до
самовывоза: логин → Home с реальными дистанциями/countdown → фильтр по категории →
OfferDetail → Checkout → оплата (mock) → экран с QR и pickup-кодом → "Мои заказы"
(новый заказ CONFIRMED) → деталь заказа (тот же QR/код) → подтверждение выдачи со
стороны заведения через `curl` (mobile не имеет business-роли — это Admin-панель,
ШАГ 10) → возврат в "Мои заказы" (статус обновился на COMPLETED без ручного релоада,
`useFocusEffect`) → Эко-профиль (баллы/кг/прогресс посчитаны верно) → RU-локализация
проверена принудительным переключением языка (браузер в этом окружении отдаёт `en`).

Один пункт не проверен до конца: клик "Да, отменить" в диалоге отмены заказа — сам
built-in browser tool намеренно подавляет нативные `confirm()`/`alert()` диалоги
("native JavaScript dialogs are disabled in this browser") в целях безопасности,
так что через него нельзя докликать до "да". Эндпоинт `PATCH /orders/:id/cancel`
уже проверен `curl`'ом в ШАГ 4/5 smoke-тестах; сама mobile-обёртка — однострочный
вызов, структурно идентичный уже проверенным `create`/`complete`.
