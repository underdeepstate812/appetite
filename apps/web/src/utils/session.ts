import type { AuthTokens, User } from "@apetite/shared";

const USER_KEY = "apetite.web.user";

/**
 * Сайт — маркетинговый, не полноценное веб-приложение (тот опыт — в мобильном
 * приложении): после входа/регистрации токены не нужны для дальнейших запросов
 * здесь, только имя для приветствия на экране успеха. Сохраняем по-минимуму.
 */
export function rememberSession(user: User, _tokens: AuthTokens) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify({ name: user.name, email: user.email }));
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — не критично для этой страницы.
  }
}

export function readRememberedName(): string | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { name?: string }).name ?? null;
  } catch {
    return null;
  }
}
