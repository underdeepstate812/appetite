import type { AuthTokens, LoginRequest, RegisterRequest, RequestOtpRequest, User, VerifyOtpRequest } from "@apetite/shared";
import { apiClient } from "./client";

export interface AuthResponse extends AuthTokens {
  user: User;
}

export const authApi = {
  login: (input: LoginRequest) => apiClient.post<AuthResponse>("/auth/login", input),
  register: (input: RegisterRequest) => apiClient.post<AuthResponse>("/auth/register", input),
  requestOtp: (input: RequestOtpRequest) => apiClient.post<{ success: boolean }>("/auth/otp/request", input),
  verifyOtp: (input: VerifyOtpRequest) => apiClient.post<{ verified: boolean }>("/auth/otp/verify", input),
};
