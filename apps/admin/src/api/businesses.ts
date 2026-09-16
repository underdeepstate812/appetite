import type { Business, BusinessStats } from "@apetite/shared";
import { apiClient } from "./client";

export interface UpdateBusinessRequest {
  name?: string;
  description?: string;
  address?: string;
}

export const businessesApi = {
  mine: () => apiClient.get<Business[]>("/businesses/mine"),
  update: (id: string, input: UpdateBusinessRequest) => apiClient.patch<Business>(`/businesses/${id}`, input),
  stats: (id: string) => apiClient.get<BusinessStats>(`/businesses/${id}/stats`),
};
