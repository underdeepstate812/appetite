import { Linking, Platform } from "react-native";

/**
 * Открыть письмо (mailto:). На web RN открывает любые ссылки через window.open(_blank) — для mailto это даёт пустую вкладку,
 * которая остаётся после запуска почтового клиента. Якорь без target уходит прямо в почтовый клиент, вкладка не появляется.
 * Отказ (исключение при клике; на native — Linking.openURL отклонён) возвращается как rejected-промис: вызывающий покажет адрес.
 */
export function openMailLink(url: string): Promise<void> {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return Linking.openURL(url).then(() => undefined);
}
