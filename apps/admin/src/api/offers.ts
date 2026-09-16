import type { Offer, OfferCategory, OfferStatus, Paginated } from "@apetite/shared";
import { apiClient, toQueryString } from "./client";

export interface ListOffersQuery {
  businessId?: string;
  category?: OfferCategory;
  status?: OfferStatus;
  page?: number;
  pageSize?: number;
}

export interface CreateOfferRequest {
  businessId: string;
  title: string;
  description?: string;
  category: OfferCategory;
  /** Рубли, не копейки — backend сам переводит в минорные единицы. */
  originalPriceRub: number;
  weightKg: number;
  quantityTotal: number;
  pickupStart: string;
  pickupEnd: string;
}

export interface UpdateOfferRequest {
  title?: string;
  description?: string;
  category?: OfferCategory;
  originalPriceRub?: number;
  weightKg?: number;
  pickupStart?: string;
  pickupEnd?: string;
  status?: OfferStatus;
}

export const offersApi = {
  list: (query: ListOffersQuery = {}) => apiClient.get<Paginated<Offer>>(`/offers${toQueryString(query)}`),
  create: (input: CreateOfferRequest) => apiClient.post<Offer>("/offers", input),
  update: (id: string, input: UpdateOfferRequest) => apiClient.patch<Offer>(`/offers/${id}`, input),
  remove: (id: string) => apiClient.delete<{ success: boolean }>(`/offers/${id}`),
};
