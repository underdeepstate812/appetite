import { OfferCategory, getTimeLeft, getUrgencyRatio, type NearbyOffer } from "@apetite/shared";

/** Тот же порог «горящего» оффера (urgency ≥ 0.55, ≈ последние 80 минут окна), что и в мобильном приложении. */
export const HOT_URGENCY_RATIO = 0.55;

type Sortable = Pick<NearbyOffer, "pickupEnd" | "discountPercent" | "distanceKm"> & { featured?: boolean };

/** «Горячее предложение дня» (featured) горит всегда, пока окно открыто, — по времени оно «спокойное» (живёт сутки). */
export function isHotOffer(offer: Pick<NearbyOffer, "pickupEnd"> & { featured?: boolean }, now: number = Date.now()): boolean {
  const timeLeft = getTimeLeft(offer.pickupEnd, now);
  if (timeLeft.isPast) return false;
  return !!offer.featured || getUrgencyRatio(timeLeft) >= HOT_URGENCY_RATIO;
}

/**
 * Порядок витрины как в приложении: сначала «предложение дня» (featured), затем горящие, внутри группы — по убыванию скидки,
 * при равной скидке раньше тот, у кого раньше конец самовывоза, затем ближайший.
 * Закрывшиеся окна — в самый конец. Возвращает новый массив.
 */
export function sortHotFirst<T extends Sortable>(offers: T[], now: number = Date.now()): T[] {
  return offers
    .map((offer) => ({ offer, hot: isHotOffer(offer, now), closed: getTimeLeft(offer.pickupEnd, now).isPast }))
    .sort((a, b) => {
      if (a.closed !== b.closed) return a.closed ? 1 : -1;
      if (!!a.offer.featured !== !!b.offer.featured) return a.offer.featured ? -1 : 1;
      if (a.hot !== b.hot) return a.hot ? -1 : 1;
      if (a.offer.discountPercent !== b.offer.discountPercent) return b.offer.discountPercent - a.offer.discountPercent;
      const endDiff = new Date(a.offer.pickupEnd).getTime() - new Date(b.offer.pickupEnd).getTime();
      if (endDiff !== 0) return endDiff;
      return a.offer.distanceKm - b.offer.distanceKm;
    })
    .map(({ offer }) => offer);
}

/**
 * Порядок «рядом со мной»: сначала ближайшие (расстояние считает сервер от точки запроса — от человека, когда
 * он определён). Расстояния в пределах 50 м считаем равными: там важнее, что горит и какая скидка. Закрытые окна — в конец.
 */
export function sortNearestFirst<T extends Sortable>(offers: T[], now: number = Date.now()): T[] {
  return offers
    .map((offer) => ({ offer, hot: isHotOffer(offer, now), closed: getTimeLeft(offer.pickupEnd, now).isPast, step: Math.round(offer.distanceKm * 20) }))
    .sort((a, b) => {
      if (a.closed !== b.closed) return a.closed ? 1 : -1;
      if (a.step !== b.step) return a.step - b.step;
      if (a.hot !== b.hot) return a.hot ? -1 : 1;
      if (a.offer.discountPercent !== b.offer.discountPercent) return b.offer.discountPercent - a.offer.discountPercent;
      return a.offer.distanceKm - b.offer.distanceKm;
    })
    .map(({ offer }) => offer);
}

export interface OfferFilters {
  category: OfferCategory | "all";
  /** Границы цены в целых рублях; null — не задана. Сравниваем с ТЕКУЩЕЙ ценой со скидкой. */
  minRub: number | null;
  maxRub: number | null;
  onlyHot: boolean;
}

type Filterable = Pick<NearbyOffer, "category" | "discountedPrice" | "pickupEnd"> & { featured?: boolean };

/**
 * Единое правило фильтров витрины: им пользуются и лента с картой, и счётчик «Показать N» в панели фильтров, чтобы
 * цифра на кнопке всегда совпадала с тем, что человек увидит. Фильтруем на клиенте: набор города небольшой, зато счётчики
 * точные, а смена фильтра мгновенная и не перетряхивает карту запросом.
 */
export function filterOffers<T extends Filterable>(offers: T[], filters: OfferFilters, now: number = Date.now()): T[] {
  return offers.filter((offer) => {
    const category = sanitizeCategory(filters.category);
    if (category !== "all" && offer.category !== category) return false;
    if (filters.minRub !== null && offer.discountedPrice < filters.minRub * 100) return false;
    if (filters.maxRub !== null && offer.discountedPrice > filters.maxRub * 100) return false;
    if (filters.onlyHot && !isHotOffer(offer, now)) return false;
    return true;
  });
}

/** Сколько предложений в каждой категории при остальных фильтрах — для подписей на чипах категорий. */
export function countByCategory<T extends Filterable>(offers: T[], filters: Omit<OfferFilters, "category">, now: number = Date.now()): Record<OfferCategory | "all", number> {
  // Ноль у пустой категории указываем явно: по нему панель фильтров отключает чип, а «нет ключа» читалось бы как «неизвестно».
  const result = { all: 0 } as Record<OfferCategory | "all", number>;
  for (const category of Object.values(OfferCategory)) result[category] = 0;
  for (const offer of filterOffers(offers, { ...filters, category: "all" }, now)) {
    result.all += 1;
    if (isOfferCategory(offer.category)) result[offer.category] += 1;
  }
  return result;
}

/** Самая низкая и самая высокая цена среди предложений, в целых рублях (вниз/вверх) — подсказка в панели фильтров. */
export function priceBounds(offers: Array<Pick<NearbyOffer, "discountedPrice">>): { min: number; max: number } | null {
  if (offers.length === 0) return null;
  const prices = offers.map((offer) => offer.discountedPrice);
  return { min: Math.floor(Math.min(...prices) / 100), max: Math.ceil(Math.max(...prices) / 100) };
}

const CATEGORIES: readonly string[] = Object.values(OfferCategory);

/** Значение — одна из настоящих категорий (а не мусор из состояния/ссылки/старой вкладки). */
export function isOfferCategory(value: unknown): value is OfferCategory {
  return typeof value === "string" && CATEGORIES.includes(value);
}

/** Категория для фильтра: настоящая категория или «all»; всё остальное — «all» (иначе витрина показала бы пустоту без объяснений). */
export function sanitizeCategory(value: unknown): OfferCategory | "all" {
  return isOfferCategory(value) ? value : "all";
}
