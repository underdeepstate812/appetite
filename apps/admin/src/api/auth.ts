import type { AuthTokens, LoginRequest, User } from "@apetite/shared";
import { apiClient } from "./client";

export interface AuthResponse extends AuthTokens {
  user: User;
}

export const authApi = {
  login: (input: LoginRequest) => apiClient.post<AuthResponse>("/auth/login", input, { auth: false }),
  me: () => apiClient.get<User>("/auth/me"),
  logout: () => apiClient.post<{ success: boolean }>("/auth/logout"),
  refresh: (refreshToken: string) =>
    apiClient.post<AuthTokens>("/auth/refresh", undefined, {
      auth: false,
      headers: { Authorization: `Bearer ${refreshToken}` },
    }),
};
