import { useEffect, useRef, useState } from "react";
import type { Order } from "@apetite/shared";
import { offersApi } from "../api/offers";
import { businessesApi } from "../api/businesses";

/** В заказе есть только offerId и businessId — названия подтягиваем для читаемого списка, но не больше стольких, чтобы не завалить API. */
const MAX_LOOKUPS = 30;

// Названия не меняются в течение жизни заказа, а список перезагружается при каждом возврате на вкладку:
// без кэша строки каждый раз «мигали» бы пустыми заголовками.
const titles = new Map<string, string>();
const venues = new Map<string, string>();
// Запросы «в полёте»: повторный запуск эффекта (новая ссылка на массив заказов) не должен дублировать их.
const inflight = new Set<string>();

/** Для тестов: кэш живёт на уровне модуля. */
export function clearOrderLabelCache() {
  titles.clear();
  venues.clear();
  inflight.clear();
}

/** Из офлайн-копии списка: подписи к строкам доступны сразу, без запросов. */
export function seedOrderLabels(savedTitles: Record<string, string>, savedVenues: Record<string, string>) {
  Object.entries(savedTitles).forEach(([id, title]) => titles.set(id, title));
  Object.entries(savedVenues).forEach(([id, name]) => venues.set(id, name));
}

/** То, что уже известно о заказах из списка, — для сохранения вместе со списком. */
export function snapshotOrderLabels(orders: Order[]) {
  const savedTitles: Record<string, string> = {};
  const savedVenues: Record<string, string> = {};
  for (const order of orders) {
    const title = titles.get(order.offerId);
    const venue = venues.get(order.businessId);
    if (title) savedTitles[order.offerId] = title;
    if (venue) savedVenues[order.businessId] = venue;
  }
  return { titles: savedTitles, venues: savedVenues };
}

const missing = (ids: string[], cache: Map<string, string>) => [...new Set(ids)].filter((id) => !cache.has(id)).slice(0, MAX_LOOKUPS);

/**
 * Читаемые подписи для списка заказов: название оффера и заведение. Сбой отдельного запроса не ломает список —
 * строка просто остаётся без подписи (и повторит попытку при следующем заходе).
 */
export function useOrderLabels(orders: Order[] | null) {
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  const batches = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!orders) return;
    const offerIds = missing(orders.map((order) => order.offerId), titles).filter((id) => !inflight.has(`o:${id}`));
    const businessIds = missing(orders.map((order) => order.businessId), venues).filter((id) => !inflight.has(`b:${id}`));
    if (offerIds.length === 0 && businessIds.length === 0) return;

    const keys = [...offerIds.map((id) => `o:${id}`), ...businessIds.map((id) => `b:${id}`)];
    keys.forEach((key) => inflight.add(key));
    batches.current += 1;
    setPending(true);
    Promise.allSettled([
      ...offerIds.map((id) => offersApi.get(id).then((offer) => void titles.set(id, offer.title))),
      ...businessIds.map((id) => businessesApi.get(id).then((business) => void venues.set(id, business.name))),
    ]).then(() => {
      keys.forEach((key) => inflight.delete(key));
      batches.current -= 1;
      if (!mounted.current) return;
      setPending(batches.current > 0);
      setVersion((n) => n + 1);
    });
  }, [orders]);

  return {
    pending,
    /** Растёт каждый раз, когда подгрузились новые подписи: по нему можно перезаписать копию, не полагаясь на переход pending. */
    version,
    titleOf: (order: Order) => titles.get(order.offerId),
    venueOf: (order: Order) => venues.get(order.businessId),
  };
}
