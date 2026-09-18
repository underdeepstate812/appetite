import type { BusinessApplicationRequest } from "@apetite/shared";
import { apiClient } from "./client";

export const businessApplicationsApi = {
  create: (input: BusinessApplicationRequest) =>
    apiClient.post<{ id: string }>("/business-applications", input),
};
