import { useSyncExternalStore } from "react";
import type { AuthTokens, LoginRequest, RegisterRequest, User } from "@apetite/shared";
import { authApi, type AuthResponse } from "../api/auth";
import { ApiError, configureApiClient } from "../api/client";
import { revokeOneClickConsent } from "../utils/paymentPrefs";

const ACCESS_KEY = "apetite.web.accessToken";
const REFRESH_KEY = "apetite.web.refreshToken";
const USER_KEY = "apetite.web.user";

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** true, когда токены из localStorage прочитаны и (если были) профиль подтверждён сервером — можно решать, пускать ли на защищённую страницу. */
  isHydrated: boolean;
}

/**
 * Токены лежат в localStorage — для SPA без собственного серверного рендера это стандартный
 * компромисс (httpOnly-cookie потребовали бы отдельной cookie-схемы на backend). Поэтому access-токен
 * короткоживущий, а выход вызывает /auth/logout, который инвалидирует refresh на сервере.
 * Приватный режим/запрет хранилища не ломают приложение: сессия просто живёт до перезагрузки.
 */
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // хранилище недоступно — не критично
  }
}

function readCachedUser(): User | null {
  const raw = readStorage(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

let state: AuthState = { user: null, accessToken: null, refreshToken: null, isHydrated: false };
const listeners = new Set<() => void>();

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function persist(tokens: AuthTokens, user?: User) {
  writeStorage(ACCESS_KEY, tokens.accessToken);
  writeStorage(REFRESH_KEY, tokens.refreshToken);
  if (user) writeStorage(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  revokeOneClickConsent();
  writeStorage(ACCESS_KEY, null);
  writeStorage(REFRESH_KEY, null);
  writeStorage(USER_KEY, null);
  setState({ user: null, accessToken: null, refreshToken: null });
}

function applyAuthResponse(data: AuthResponse) {
  persist(data, data.user);
  setState({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
}

let hydrating: Promise<void> | null = null;

export const authActions = {
  hydrate(): Promise<void> {
    hydrating ??= (async () => {
      const accessToken = readStorage(ACCESS_KEY);
      const refreshToken = readStorage(REFRESH_KEY);
      if (!accessToken || !refreshToken) {
        setState({ isHydrated: true });
        return;
      }
      // Кэшированный профиль показываем сразу (шапка не мигает «Войти»), сервер подтвердит ниже.
      setState({ accessToken, refreshToken, user: readCachedUser() });
      try {
        const user = await authApi.me();
        writeStorage(USER_KEY, JSON.stringify(user));
        setState({ user, isHydrated: true });
      } catch (error) {
        // Сессию стираем только когда сервер ответил, что токены недействительны. Нет сети или 5xx —
        // не повод разлогинивать: профиль остаётся из кэша.
        const rejected = error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403);
        if (rejected) clearSession();
        setState({ isHydrated: true });
      }
    })();
    return hydrating;
  },

  async login(input: LoginRequest) {
    applyAuthResponse(await authApi.login(input));
  },

  async register(input: RegisterRequest) {
    applyAuthResponse(await authApi.register(input));
  },

  async logout() {
    if (state.accessToken) {
      try {
        await authApi.logout();
      } catch {
        // best-effort — локальную сессию всё равно чистим
      }
    }
    clearSession();
  },

  async refreshTokens(): Promise<boolean> {
    const refreshToken = state.refreshToken;
    if (!refreshToken) return false;
    try {
      const tokens = await authApi.refresh(refreshToken);
      persist(tokens);
      setState({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      return true;
    } catch (error) {
      // Сеть моргнула — сессия может быть ещё жива, не выкидываем. Сервер отказал — токен мёртв.
      if (error instanceof ApiError && error.statusCode !== 0) clearSession();
      return false;
    }
  },
};

configureApiClient({
  getAccessToken: () => state.accessToken,
  refreshTokens: () => authActions.refreshTokens(),
  onUnauthorized: clearSession,
});

// Выход/вход в соседней вкладке: подхватываем без перезагрузки, чтобы вкладки не расходились.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== ACCESS_KEY && event.key !== REFRESH_KEY && event.key !== USER_KEY) return;
    setState({
      accessToken: readStorage(ACCESS_KEY),
      refreshToken: readStorage(REFRESH_KEY),
      user: readStorage(ACCESS_KEY) ? readCachedUser() : null,
    });
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state);
}

/** Для тестов: сброс модульного состояния между кейсами. */
export function __resetAuthForTests() {
  state = { user: null, accessToken: null, refreshToken: null, isHydrated: false };
  hydrating = null;
  listeners.forEach((listener) => listener());
}
