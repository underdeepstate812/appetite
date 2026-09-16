import { create } from "zustand";
import type { LoginRequest, RegisterRequest, User } from "@apetite/shared";
import { authApi } from "../api/auth";
import { configureApiClient } from "../api/client";
import { tokenStorage } from "./tokenStorage";

const ACCESS_TOKEN_KEY = "apetite.accessToken";
const REFRESH_TOKEN_KEY = "apetite.refreshToken";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** true, когда токены из secure storage уже прочитаны (можно показывать UI). */
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
}

async function persistTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    tokenStorage.setItem(ACCESS_TOKEN_KEY, accessToken),
    tokenStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

async function clearTokens() {
  await Promise.all([tokenStorage.removeItem(ACCESS_TOKEN_KEY), tokenStorage.removeItem(REFRESH_TOKEN_KEY)]);
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isHydrated: false,
  isLoading: false,
  error: null,

  hydrate: async () => {
    const [accessToken, refreshToken] = await Promise.all([
      tokenStorage.getItem(ACCESS_TOKEN_KEY),
      tokenStorage.getItem(REFRESH_TOKEN_KEY),
    ]);
    if (!accessToken || !refreshToken) {
      set({ isHydrated: true });
      return;
    }
    set({ accessToken, refreshToken });
    try {
      const user = await authApi.me();
      set({ user, isHydrated: true });
    } catch {
      await clearTokens();
      set({ accessToken: null, refreshToken: null, user: null, isHydrated: true });
    }
  },

  login: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.login(input);
      await persistTokens(data.accessToken, data.refreshToken);
      set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Ошибка входа" });
      throw error;
    }
  },

  register: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.register(input);
      await persistTokens(data.accessToken, data.refreshToken);
      set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Ошибка регистрации" });
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
    await clearTokens();
    set({ user: null, accessToken: null, refreshToken: null });
  },

  refreshTokens: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) return false;
    try {
      const tokens = await authApi.refresh(refreshToken);
      await persistTokens(tokens.accessToken, tokens.refreshToken);
      set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      return true;
    } catch {
      await clearTokens();
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
