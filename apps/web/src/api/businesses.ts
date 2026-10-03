import type { Business } from "@apetite/shared";
import { apiClient } from "./client";

export const businessesApi = {
  get: (id: string) => apiClient.get<Business>(`/businesses/${id}`, { auth: false }),
};
