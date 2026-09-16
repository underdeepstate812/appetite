import type { Business, BusinessStats, BusinessStatus, OfferCategory } from "@apetite/shared";
import { apiClient } from "./client";

export interface UpdateBusinessRequest {
  name?: string;
  description?: string;
  address?: string;
  /** ADMIN-only — backend молча игнорирует поле для не-админа. */
  status?: BusinessStatus;
  commissionPercent?: number;
}

export interface CreateBusinessRequest {
  ownerEmail: string;
  ownerPassword: string;
  ownerName: string;
  name: string;
  description?: string;
  category: OfferCategory;
  address: string;
  lat: number;
  lng: number;
}

export const businessesApi = {
  mine: () => apiClient.get<Business[]>("/businesses/mine"),
  update: (id: string, input: UpdateBusinessRequest) => apiClient.patch<Business>(`/businesses/${id}`, input),
  stats: (id: string) => apiClient.get<BusinessStats>(`/businesses/${id}/stats`),
  /** ADMIN-only — ручной онбординг (ШАГ 0/11): один запрос создаёт и владельца, и заведение. */
  create: (input: CreateBusinessRequest) => apiClient.post<Business>("/businesses", input),
};
