import { create } from "zustand";
import type { LoginRequest, RegisterRequest, User } from "@apetite/shared";
import { authApi } from "../api/auth";
import { ApiError, configureApiClient } from "../api/client";
import { tokenStorage } from "./tokenStorage";

const ACCESS_TOKEN_KEY = "apetite.accessToken";
const REFRESH_TOKEN_KEY = "apetite.refreshToken";
const USER_CACHE_KEY = "apetite.user";

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
  /** Профиль/аватар обновились на backend — подменяем локальную копию без полного relogin. */
  setUser: (user: User) => void;
}

async function persistTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    tokenStorage.setItem(ACCESS_TOKEN_KEY, accessToken),
    tokenStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

async function clearTokens() {
  await Promise.all([
    tokenStorage.removeItem(ACCESS_TOKEN_KEY),
    tokenStorage.removeItem(REFRESH_TOKEN_KEY),
    tokenStorage.removeItem(USER_CACHE_KEY),
  ]);
}

/** Последняя известная копия профиля — чтобы без сети приложение открывалось, а не выкидывало на экран входа. */
async function cacheUser(user: User) {
  try {
    await tokenStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // кэш — best-effort
  }
}

async function readCachedUser(): Promise<User | null> {
  try {
    const raw = await tokenStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
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
      await cacheUser(user);
      set({ user, isHydrated: true });
    } catch (error) {
      // Токены стираем только когда сервер ответил, что они недействительны (401/403). Нет сети, таймаут
      // или 5xx — не повод разлогинивать: раньше любой сбой на старте выкидывал на экран входа.
      const rejected = error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403);
      if (rejected) {
        await clearTokens();
        set({ accessToken: null, refreshToken: null, user: null, isHydrated: true });
        return;
      }
      set({ user: await readCachedUser(), isHydrated: true });
    }
  },

  login: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.login(input);
      await persistTokens(data.accessToken, data.refreshToken);
      await cacheUser(data.user);
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
      await cacheUser(data.user);
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

  setUser: (user) => {
    set({ user });
    void cacheUser(user);
  },
}));

configureApiClient({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshTokens: () => useAuthStore.getState().refreshTokens(),
  onUnauthorized: () => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
  },
});
