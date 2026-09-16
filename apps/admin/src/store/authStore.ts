import { create } from "zustand";
import type { LoginRequest, User } from "@apetite/shared";
import { authApi } from "../api/auth";
import { configureApiClient } from "../api/client";

const ACCESS_TOKEN_KEY = "apetite.admin.accessToken";
const REFRESH_TOKEN_KEY = "apetite.admin.refreshToken";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** true, когда токены из localStorage уже прочитаны (можно показывать UI). */
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
}

function persistTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isHydrated: false,
  isLoading: false,
  error: null,

  hydrate: async () => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!accessToken || !refreshToken) {
      set({ isHydrated: true });
      return;
    }
    set({ accessToken, refreshToken });
    try {
      const user = await authApi.me();
      if (user.role !== "BUSINESS") {
        // Панель — только для владельцев заведений; ADMIN/USER сюда не логинятся.
        throw new Error("Эта панель доступна только владельцам заведений");
      }
      set({ user, isHydrated: true });
    } catch {
      clearTokens();
      set({ accessToken: null, refreshToken: null, user: null, isHydrated: true });
    }
  },

  login: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.login(input);
      if (data.user.role !== "BUSINESS") {
        throw new Error("Эта панель доступна только владельцам заведений");
      }
      persistTokens(data.accessToken, data.refreshToken);
      set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Ошибка входа" });
      throw error;
    }
  },

  logout: async () => {
    if (get().accessToken) {
      try {
        await authApi.logout();
      } catch {
        // best-effort — всё равно чистим локальное состояние
      }
    }
    clearTokens();
    set({ user: null, accessToken: null, refreshToken: null });
  },

  refreshTokens: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) return false;
    try {
      const tokens = await authApi.refresh(refreshToken);
      persistTokens(tokens.accessToken, tokens.refreshToken);
      set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      return true;
    } catch {
      clearTokens();
      set({ user: null, accessToken: null, refreshToken: null });
      return false;
    }
  },
}));

configureApiClient({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshTokens: () => useAuthStore.getState().refreshTokens(),
  onUnauthorized: () => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
  },
});
