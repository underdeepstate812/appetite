import type { NearbyOffer } from "@apetite/shared";
import { apiClient } from "./client";

export interface NearbyOffersQuery {
  lat: number;
  lng: number;
  radiusKm: number;
}

export const offersApi = {
  nearby: (query: NearbyOffersQuery) => {
    const params = new URLSearchParams({
      lat: String(query.lat),
      lng: String(query.lng),
      radiusKm: String(query.radiusKm),
    });
    return apiClient.get<NearbyOffer[]>(`/offers/nearby?${params.toString()}`);
  },
};
