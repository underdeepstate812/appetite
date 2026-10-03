import { useCallback, useEffect, useState } from "react";

/** Центр Санкт-Петербурга (пилот) — фолбэк, пока нет разрешения на геолокацию или браузер её не поддерживает. */
export const SPB_CENTER = { lat: 59.9311, lng: 30.3609 };

export interface UserLocation {
  lat: number;
  lng: number;
  /** true — координаты не реальные, а центр города по умолчанию. */
  isFallback: boolean;
}

export type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unavailable";

/**
 * Геолокация НЕ запрашивается при монтировании: системный диалог браузера до объяснения пугает
 * и часто отклоняется навсегда. Карта сразу работает на фолбэке (центр города), а определение
 * «где я» запускается по кнопке — тот же принцип, что и у баннера разрешений в мобильном приложении.
 * Если разрешение уже выдано ранее (Permissions API), позицию берём сразу, без диалога.
 */
export function useGeolocation() {
  const [location, setLocation] = useState<UserLocation>({ ...SPB_CENTER, isFallback: true });
  const [status, setStatus] = useState<GeoStatus>(() =>
    typeof navigator !== "undefined" && "geolocation" in navigator ? "idle" : "unavailable"
  );

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude, isFallback: false });
        setStatus("granted");
      },
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!("permissions" in navigator)) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (cancelled) return;
        if (result.state === "granted") locate();
        else if (result.state === "denied") setStatus("denied");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locate]);

  return { location, status, locate };
}
