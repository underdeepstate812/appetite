import type { Business, OfferCategory } from "@apetite/shared";
import { apiClient, toQueryString } from "./client";

export const businessesApi = {
  list: (category?: OfferCategory) =>
    apiClient.get<Business[]>(`/businesses${toQueryString({ category })}`, { auth: false }),
  get: (id: string) => apiClient.get<Business>(`/businesses/${id}`, { auth: false }),
};
