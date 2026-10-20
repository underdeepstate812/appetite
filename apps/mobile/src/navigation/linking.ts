import { getPathFromState, getStateFromPath, type LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

/**
 * URL для web-сборки: экран отражается в адресной строке, кнопка браузера "назад" возвращает на
 * предыдущий экран приложения (раньше URL всегда был "/", а "назад" выкидывал со страницы), а
 * перезагрузка возвращает пользователя туда же. На native не включаем — там навигация не URL-ная.
 * Экраны входа/регистрации лежат в другом навигаторе, но делят тот же корень — пути для них тоже заданы.
 */
/**
 * Веб-сборка на GitHub Pages живёт не в корне домена (/appetite/mobile): адрес экрана должен начинаться с этого пути, иначе
 * pushState уводит из приложения и обновление страницы даёт 404. Базовый путь берём из EXPO_PUBLIC_BASE_PATH; без него (обычная сборка) всё как раньше.
 */
const BASE = (process.env.EXPO_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export function stripBase(path: string, base: string = BASE): string {
  if (!base) return path;
  if (path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`)) return path.slice(base.length) || "/";
  return path;
}

type AnyState = { routes?: Array<{ path?: string; state?: AnyState }> } | undefined;

/**
 * getStateFromPath кладёт в маршрут `path` — тот, что ему передали (уже без базового пути). React Navigation потом берёт этот путь
 * для адресной строки как есть, и после обновления страницы адрес терял /appetite/mobile. Возвращаем базу в `path` каждого маршрута.
 */
export function withBase<T extends AnyState>(state: T, base: string = BASE): T {
  if (!state || !base) return state;
  for (const route of state.routes ?? []) {
    if (typeof route.path === "string" && route.path.startsWith("/") && !route.path.startsWith(`${base}/`) && route.path !== base) route.path = `${base}${route.path === "/" ? "/" : route.path}`;
    if (route.state) withBase(route.state, base);
  }
  return state;
}

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["apetite://"],
  ...(BASE
    ? {
        getStateFromPath: (path: string, options: Parameters<typeof getStateFromPath>[1]) => withBase(getStateFromPath(stripBase(path), options)),
        getPathFromState: (state: Parameters<typeof getPathFromState>[0], options: Parameters<typeof getPathFromState>[1]) => `${BASE}${getPathFromState(state, options)}`,
      }
    : {}),
  config: {
    screens: {
      Main: {
        path: "",
        screens: {
          Home: "",
          Map: "map",
          Orders: "orders",
          EcoProfile: "eco",
          Profile: "profile",
        },
      },
      OfferDetail: "offers/:offerId",
      Checkout: "offers/:offerId/checkout",
      OrderConfirmation: "orders/:orderId/confirmed",
      OrderDetail: "orders/:orderId",
      Notifications: "notifications",
      // Тестовый показ (UiLabScreen): в production-сборке экран не регистрируется, путь просто не разрешается.
      UiLab: "ui-lab",
      // Auth-стек (см. AuthNavigator) — не часть RootStackParamList, но тот же корень.
      ...({ Welcome: "welcome", Login: "login", Register: "register" } as object),
    },
  },
};
