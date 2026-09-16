import type { EcoSummary } from "@apetite/shared";
import { apiClient } from "./client";

export const ecoApi = {
  me: () => apiClient.get<EcoSummary>("/eco/me"),
};
