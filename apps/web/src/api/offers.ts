import type { NearbyOffer, NearbyOffersQuery, Offer } from "@apetite/shared";
import { apiClient, toQueryString } from "./client";

export const offersApi = {
  nearby: (query: NearbyOffersQuery) =>
    apiClient.get<NearbyOffer[]>(`/offers/nearby${toQueryString(query)}`, { auth: false }),
  get: (id: string) => apiClient.get<Offer>(`/offers/${id}`, { auth: false }),
};
