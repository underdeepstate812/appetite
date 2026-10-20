/** Одно предложение витрины из сида (apps/backend/prisma/city-offers.ts + showcase.ts) — см. demo:export-seed. */
export interface SeedItem {
  shop: string;
  title: string;
  description: string | null;
  category: "FOOD" | "BAKERY" | "FLOWERS" | "GROCERIES";
  originalPriceRub: number;
  baseDiscountPercent: number;
  /** Часов до конца самовывоза от момента загрузки демо. */
  hoursToEnd: number;
  quantityTotal: number;
  weightKg: number;
  image: { file: string } | { url: string } | null;
  address: string;
  lat: number;
  lng: number;
  ingredients: string | null;
  allergens: string[];
  allergensDeclared: boolean;
  /** Срок годности — часов после конца самовывоза; null — информации нет. */
  shelfHours: number | null;
}

export interface DemoOptions {
  /** Префикс запросов к API, которые перехватываем (то, что приложение считает адресом backend). */
  apiBase: string;
  /** Абсолютный URL папки с картинками сида (…/demo/): файлы из apps/backend/prisma/seed-images. */
  assetBase: string;
  /** Пауза ответа, мс — чтобы интерфейс показывал состояния загрузки, как на настоящем backend. */
  latencyMs?: number;
  /** Текущее время (для тестов). */
  now?: () => number;
  /** Плашка «Демо» в углу страницы (только в браузере): подсказывает, под кем войти, и даёт сбросить данные. */
  banner?: { app: string; lines: string[] };
  /** Где хранить изменения между перезагрузками (по умолчанию localStorage, если доступен). */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
}
