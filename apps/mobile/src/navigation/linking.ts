import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

/**
 * URL для web-сборки: экран отражается в адресной строке, кнопка браузера "назад" возвращает на
 * предыдущий экран приложения (раньше URL всегда был "/", а "назад" выкидывал со страницы), а
 * перезагрузка возвращает пользователя туда же. На native не включаем — там навигация не URL-ная.
 * Экраны входа/регистрации лежат в другом навигаторе, но делят тот же корень — пути для них тоже заданы.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["apetite://"],
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
