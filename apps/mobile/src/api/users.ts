import type { User } from "@apetite/shared";
import { apiClient } from "./client";

export const usersApi = {
  updateLocation: (lat: number, lng: number) => apiClient.patch<User>("/users/me/location", { lat, lng }),
};
