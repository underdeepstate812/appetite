import type { AuthTokens, LoginRequest, RegisterRequest, RequestOtpRequest, User, VerifyOtpRequest } from "@apetite/shared";
import { apiClient } from "./client";

export interface AuthResponse extends AuthTokens {
  user: User;
}

export const authApi = {
  login: (input: LoginRequest) => apiClient.post<AuthResponse>("/auth/login", input, { auth: false }),
  register: (input: RegisterRequest) => apiClient.post<AuthResponse>("/auth/register", input, { auth: false }),
  requestOtp: (input: RequestOtpRequest) => apiClient.post<{ success: boolean }>("/auth/otp/request", input, { auth: false }),
  verifyOtp: (input: VerifyOtpRequest) => apiClient.post<{ verified: boolean }>("/auth/otp/verify", input, { auth: false }),
  me: () => apiClient.get<User>("/auth/me"),
  logout: () => apiClient.post<{ success: boolean }>("/auth/logout"),
  refresh: (refreshToken: string) =>
    apiClient.post<AuthTokens>("/auth/refresh", undefined, {
      auth: false,
      headers: { Authorization: `Bearer ${refreshToken}` },
    }),
};
