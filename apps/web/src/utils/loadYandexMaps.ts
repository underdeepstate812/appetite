import type { YMaps3 } from "../types/ymaps3";

const SCRIPT_ID = "appetite-yandex-maps-api";
const LOAD_TIMEOUT_MS = 12_000;

let pending: Promise<YMaps3> | null = null;

/**
 * Подключает Yandex Maps JS API 3.0 один раз на страницу и ждёт готовности модулей (ymaps3.ready).
 * Отказ (нет сети, блокировщик, таймаут) — reject: вызывающий код откатывается на запасную карту,
 * а не оставляет пустую область. Повторный вызов после отказа пробует загрузить заново.
 */
export function loadYandexMaps(apiKey: string): Promise<YMaps3> {
  if (window.ymaps3) return window.ymaps3.ready.then(() => window.ymaps3 as YMaps3);
  if (pending) return pending;

  pending = new Promise<YMaps3>((resolve, reject) => {
    const fail = (reason: string) => {
      document.getElementById(SCRIPT_ID)?.remove();
      pending = null;
      reject(new Error(reason));
    };
    const timer = setTimeout(() => fail("Яндекс.Карты не загрузились вовремя"), LOAD_TIMEOUT_MS);

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    // Ключ в URL — так устроен API Яндекса (он публичный по природе: защищается ограничением по HTTP-реферреру в кабинете).
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.onload = () => {
      if (!window.ymaps3) {
        clearTimeout(timer);
        fail("Скрипт Яндекс.Карт загрузился, но API недоступен");
        return;
      }
      window.ymaps3.ready.then(
        () => {
          clearTimeout(timer);
          resolve(window.ymaps3 as YMaps3);
        },
        () => {
          clearTimeout(timer);
          fail("Яндекс.Карты не инициализировались (проверьте API-ключ)");
        }
      );
    };
    script.onerror = () => {
      clearTimeout(timer);
      fail("Не удалось загрузить Яндекс.Карты");
    };
    document.head.appendChild(script);
  });
  return pending;
}
