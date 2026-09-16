import type { NearbyOffer, NearbyOffersQuery, Offer, OfferCategory, Paginated } from "@apetite/shared";
import { apiClient, toQueryString } from "./client";

export interface ListOffersQuery {
  category?: OfferCategory;
  businessId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export const offersApi = {
  list: (query: ListOffersQuery = {}) =>
    apiClient.get<Paginated<Offer>>(`/offers${toQueryString(query)}`, { auth: false }),
  nearby: (query: NearbyOffersQuery) =>
    apiClient.get<NearbyOffer[]>(`/offers/nearby${toQueryString(query)}`, { auth: false }),
  get: (id: string) => apiClient.get<Offer>(`/offers/${id}`, { auth: false }),
};
