import type { Location } from "react-router-dom";

export const DEFAULT_AFTER_AUTH = "/home";

interface FromState {
  from?: { pathname?: string; search?: string };
}

/**
 * Куда вернуть пользователя после входа/регистрации: туда, откуда его отправили на /login
 * (RequireAuth кладёт location в state). Принимаем только внутренние пути — иначе
 * подменённый state превратил бы страницу входа в open redirect.
 */
export function getReturnPath(location: Pick<Location, "state">): string {
  const from = (location.state as FromState | null)?.from;
  const pathname = from?.pathname;
  if (!pathname || !pathname.startsWith("/") || pathname.startsWith("//") || pathname === "/login" || pathname === "/register") {
    return DEFAULT_AFTER_AUTH;
  }
  return `${pathname}${from?.search ?? ""}`;
}
