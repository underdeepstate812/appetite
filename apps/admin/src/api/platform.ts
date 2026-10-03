import type { PlatformBusinessSummary, PlatformSettings, PlatformStats } from "@apetite/shared";
import { apiClient } from "./client";

export const platformApi = {
  listBusinesses: () => apiClient.get<PlatformBusinessSummary[]>("/platform/businesses"),
  stats: () => apiClient.get<PlatformStats>("/platform/stats"),
  getSettings: () => apiClient.get<PlatformSettings>("/platform/settings"),
  updateSettings: (trialPeriodDays: number) =>
    apiClient.patch<PlatformSettings>("/platform/settings", { trialPeriodDays }),
};
