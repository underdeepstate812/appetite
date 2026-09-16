const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface BackendErrorBody {
  statusCode?: number;
  message?: string | string[];
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  /** По умолчанию true — подставляет Authorization: Bearer <accessToken>. */
  auth?: boolean;
  body?: unknown;
}

type TokenProvider = () => string | null;
type RefreshHandler = () => Promise<boolean>;
type UnauthorizedHandler = () => void;

// Клиент не импортирует authStore напрямую (чтобы не ловить циклический импорт
// store <-> client) — store сам регистрирует себя один раз при инициализации.
let getAccessToken: TokenProvider = () => null;
let refreshTokens: RefreshHandler = async () => false;
let onUnauthorized: UnauthorizedHandler = () => {};

export function configureApiClient(config: {
  getAccessToken: TokenProvider;
  refreshTokens: RefreshHandler;
  onUnauthorized: UnauthorizedHandler;
}) {
  getAccessToken = config.getAccessToken;
  refreshTokens = config.refreshTokens;
  onUnauthorized = config.onUnauthorized;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { auth = true, headers, body, ...rest } = options;
  const token = auth ? getAccessToken() : null;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && auth && !isRetry) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, options, true);
    }
    onUnauthorized();
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const errorBody = data as BackendErrorBody | undefined;
    const message = Array.isArray(errorBody?.message)
      ? errorBody.message.join(", ")
      : (errorBody?.message ?? "Запрос не выполнен");
    throw new ApiError(errorBody?.statusCode ?? response.status, message);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};

export function toQueryString(params: object): string {
  const entries = Object.entries(params as Record<string, string | number | boolean | undefined>).filter(
    ([, value]) => value !== undefined && value !== ""
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&");
}
