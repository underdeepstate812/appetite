const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

// Origin бэкенда (без /api/v1) — статику (/uploads/...) backend отдаёт вне
// версионированного префикса. URL.origin в RN исторически не реализован — режем регэкспом.
const API_ORIGIN = BASE_URL.match(/^(https?:\/\/[^/]+)/)?.[1] ?? BASE_URL;

/** Относительный путь из API (/uploads/avatars/x.jpg) → полный URL для <Image source={{ uri }} />. */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

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
  // FormData (аватар и т.п.) отправляем как есть — fetch сам проставит Content-Type
  // с правильным multipart boundary, задать его вручную здесь и сломать нельзя.
  const isFormData = body instanceof FormData;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
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
  // Приводим к Record для итерации — вызывающие передают конкретные интерфейсы
  // (ListOffersQuery и т.п.) без индексной сигнатуры, TS их напрямую не примет.
  const entries = Object.entries(params as Record<string, string | number | boolean | undefined>).filter(
    ([, value]) => value !== undefined && value !== ""
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&");
}
