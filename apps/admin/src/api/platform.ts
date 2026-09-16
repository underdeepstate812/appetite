import type { PlatformBusinessSummary, PlatformStats } from "@apetite/shared";
import { apiClient } from "./client";

export const platformApi = {
  listBusinesses: () => apiClient.get<PlatformBusinessSummary[]>("/platform/businesses"),
  stats: () => apiClient.get<PlatformStats>("/platform/stats"),
};
