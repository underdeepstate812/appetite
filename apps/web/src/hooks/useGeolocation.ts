import { useCallback, useEffect, useRef, useState } from "react";
import { SPB_CENTER } from "../utils/geo";

export { SPB_CENTER };

export interface UserLocation {
  lat: number;
  lng: number;
  /** true — координаты не реальные, а центр города по умолчанию. */
  isFallback: boolean;
}

/**
 * idle — позицию не просили; locating — ждём ответ браузера; granted — позиция получена;
 * denied — доступ запрещён (в диалоге или в настройках сайта); timeout / unavailable — не вышло определить;
 * insecure — страница открыта не по HTTPS, браузер не даст геолокацию в принципе.
 */
export type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unavailable" | "timeout" | "insecure";

const FALLBACK: UserLocation = { ...SPB_CENTER, isFallback: true };

/** Позицию помним на время сессии вкладки: вернулись с оформления заказа — витрина снова «рядом со мной», без мигания городом. */
const CACHE_KEY = "apetite.web.geo";
const CACHE_TTL_MS = 30 * 60_000;
/**
 * Пока человек не ответил на диалог браузера, таймаут запроса не идёт (так устроен API), и «Определяем…» висело бы вечно.
 * Через это время показываем «не вышло, повторите» — а если ответ всё-таки придёт позже, он применится как обычно.
 */
export const LOCATE_WATCHDOG_MS = 20_000;

function readCache(): UserLocation | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null") as { lat?: number; lng?: number; at?: number } | null;
    if (!parsed || !Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng) || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return { lat: parsed.lat as number, lng: parsed.lng as number, isFallback: false };
  } catch {
    return null;
  }
}

function writeCache(location: UserLocation) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ lat: location.lat, lng: location.lng, at: Date.now() }));
  } catch {
    // не запомнится — не страшно
  }
}

function clearCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // нечего чистить
  }
}

/** Браузер вообще не отдаст позицию: нет API или страница не в защищённом контексте (HTTP не на localhost). */
function unsupported(): GeoStatus | null {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return "unavailable";
  if (typeof window !== "undefined" && window.isSecureContext === false) return "insecure";
  return null;
}

/**
 * Геолокация НЕ запрашивается при монтировании: системный диалог браузера до объяснения пугает и часто
 * отклоняется навсегда. Витрина сразу работает на центре города, а определение «где я» запускается по кнопке
 * (или по мягкому приглашению с объяснением) — тот же принцип, что и у баннера разрешений в мобильном приложении.
 * Если разрешение уже выдано ранее (Permissions API), позицию берём сразу, без диалога; если человек потом
 * поменял разрешение в настройках сайта, витрина подхватывает это сама (событие change).
 */
export function useGeolocation() {
  const [cached] = useState(readCache);
  const [location, setLocation] = useState<UserLocation>(cached ?? FALLBACK);
  const [status, setStatus] = useState<GeoStatus>(() => unsupported() ?? (cached ? "granted" : "idle"));
  const hadCache = useRef(cached !== null);
  const watchdog = useRef(0);

  /** quiet — позиция уже есть (из кэша), просто обновляем её: статус не мигает «Определяем…», а сбой ничего не ломает. */
  const request = useCallback((quiet: boolean) => {
    const blocked = unsupported();
    if (blocked) {
      setStatus(blocked);
      return;
    }
    if (!quiet) {
      setStatus("locating");
      window.clearTimeout(watchdog.current);
      watchdog.current = window.setTimeout(() => setStatus((current) => (current === "locating" ? "timeout" : current)), LOCATE_WATCHDOG_MS);
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(watchdog.current);
        const next: UserLocation = { lat: position.coords.latitude, lng: position.coords.longitude, isFallback: false };
        writeCache(next);
        setLocation(next);
        setStatus("granted");
      },
      (error) => {
        if (quiet) return;
        window.clearTimeout(watchdog.current);
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : error.code === error.TIMEOUT ? "timeout" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 }
    );
  }, []);

  const locate = useCallback(() => request(false), [request]);

  /** «Весь город»: забываем позицию и возвращаемся к центру. Само разрешение браузера остаётся — повторное «Рядом со мной» без диалога. */
  const reset = useCallback(() => {
    window.clearTimeout(watchdog.current);
    clearCache();
    hadCache.current = false;
    setLocation(FALLBACK);
    setStatus(unsupported() ?? "idle");
  }, []);

  useEffect(() => {
    if (unsupported() || !("permissions" in navigator)) return;
    let cancelled = false;
    let result: PermissionStatus | null = null;

    const apply = (state: PermissionState, initial: boolean) => {
      if (cancelled) return;
      if (state === "granted") {
        request(initial && hadCache.current);
      } else if (state === "denied") {
        clearCache();
        hadCache.current = false;
        setLocation(FALLBACK);
        setStatus("denied");
      } else if (!initial || hadCache.current) {
        // Разрешение сбросили в настройках сайта (в т.ч. пока вкладка была закрыта) — возвращаемся к городу и снова готовы спросить.
        clearCache();
        hadCache.current = false;
        setLocation(FALLBACK);
        setStatus("idle");
      }
    };
    const onChange = () => result && apply(result.state, false);

    navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        if (cancelled) return;
        result = permission;
        apply(permission.state, true);
        permission.addEventListener?.("change", onChange);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      result?.removeEventListener?.("change", onChange);
    };
  }, [request]);

  useEffect(() => () => window.clearTimeout(watchdog.current), []);

  return { location, status, locate, reset };
}
