import { useCallback, useEffect, useState } from "react";
import type { NearbyOffer, OfferCategory } from "@apetite/shared";
import { offersApi } from "../api/offers";
import type { UserLocation } from "./useLocation";

export const DEFAULT_RADIUS_KM = 10;

export interface OffersFilters {
  category?: OfferCategory;
  minDiscount?: number;
  radiusKm: number;
}

export function useNearbyOffers(location: UserLocation | null, filters: OffersFilters) {
  const [offers, setOffers] = useState<NearbyOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!location) return;
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const data = await offersApi.nearby({
          lat: location.lat,
          lng: location.lng,
          radiusKm: filters.radiusKm,
          category: filters.category,
          minDiscount: filters.minDiscount,
        });
        setOffers(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "error");
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [location, filters.category, filters.minDiscount, filters.radiusKm]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { offers, error, refreshing, refresh: () => load(true) };
}
