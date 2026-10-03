import { useCallback, useEffect, useRef, useState } from "react";
import type { NearbyOffer, OfferCategory } from "@apetite/shared";
import { offersApi } from "../api/offers";

/** Весь город: самые дальние районы (Ульянка, Лахта, Купчино) лежат в 14–15 км от центра. */
export const DEFAULT_RADIUS_KM = 20;
/** Витрина живёт временем (скидка растёт, окна закрываются) — тихо обновляем раз в минуту. */
const REFRESH_MS = 60_000;

export interface OffersFilters {
  category?: OfferCategory;
  radiusKm?: number;
}

export function useNearbyOffers(center: { lat: number; lng: number }, filters: OffersFilters) {
  const [offers, setOffers] = useState<NearbyOffer[] | null>(null);
  const [dataKey, setDataKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const { category, radiusKm = DEFAULT_RADIUS_KM } = filters;

  const load = useCallback(
    async (silent: boolean) => {
      // Ответы могут прийти не по порядку (быстро сменили фильтр) — применяем только последний запрос.
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      try {
        const data = await offersApi.nearby({ lat: center.lat, lng: center.lng, radiusKm, category });
        if (id !== requestId.current) return;
        setOffers(data);
        setDataKey(`${center.lat},${center.lng},${radiusKm},${category ?? ""}`);
        setError(null);
      } catch (loadError) {
        if (id !== requestId.current) return;
        // Тихое обновление не должно затирать уже показанную витрину ошибкой.
        if (!silent || offers === null) setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить предложения");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [center.lat, center.lng, radiusKm, category]
  );

  useEffect(() => {
    void load(false);
    const timer = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { offers, dataKey, error, loading, reload: () => load(false) };
}
