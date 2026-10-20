const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

// Origin бэкенда (без /api/v1): статику (/uploads/...) backend отдаёт вне версионированного префикса.
const API_ORIGIN = BASE_URL.match(/^(https?:\/\/[^/]+)/)?.[1] ?? BASE_URL;

/** Относительный путь из API (/uploads/logos/x.jpg) → полный URL для <img src>. Абсолютные URL не трогаем. */
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

/** statusCode 0 — до сервера не дошли (нет сети, сервер лежит, CORS), а не ответ сервера. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 0;
}

interface BackendErrorBody {
  statusCode?: number;
  message?: string | string[];
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  /** По умолчанию true — подставляет Authorization: Bearer <accessToken>, на 401 пробует refresh. */
  auth?: boolean;
  body?: unknown;
}

type TokenProvider = () => string | null;
type RefreshHandler = () => Promise<boolean>;
type UnauthorizedHandler = () => void;

// Клиент не импортирует стор напрямую (иначе циклический импорт client <-> store):
// стор регистрирует себя один раз при инициализации — тот же приём, что в mobile/api/client.ts.
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

// Параллельные запросы, получившие 401 одновременно, делят один refresh: refresh-токен
// ротируется, и второй параллельный вызов с уже использованным токеном разлогинил бы пользователя.
let refreshInFlight: Promise<boolean> | null = null;
function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= refreshTokens().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { auth = true, headers, body, ...rest } = options;
  const token = auth ? getAccessToken() : null;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: {
        // multipart (загрузка фото) браузер размечает сам, вместе с boundary — свой Content-Type тут сломал бы запрос.
        ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    // fetch бросает TypeError("Failed to fetch"), когда до сервера не дошли — показываем понятный текст.
    throw new ApiError(0, "Нет соединения с сервером. Проверь интернет и попробуй ещё раз.");
  }

  if (response.status === 401 && auth && !isRetry && token) {
    if (await refreshOnce()) {
      return request<T>(path, options, true);
    }
    onUnauthorized();
  }

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // Прокси/туннель может вернуть HTML-страницу ошибки вместо JSON — это не повод падать SyntaxError'ом.
    throw new ApiError(response.status, "Сервер вернул неожиданный ответ. Попробуй ещё раз.");
  }

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
};

export function toQueryString(params: object): string {
  const entries = Object.entries(params as Record<string, string | number | boolean | undefined>).filter(
    ([, value]) => value !== undefined && value !== ""
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&");
}
