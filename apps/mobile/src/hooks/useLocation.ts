import { useEffect, useState } from "react";
import * as Location from "expo-location";

/** Центр Москвы (пилот, ШАГ 0) — фолбэк, если геопермишен не выдан/недоступен. */
const MOSCOW_CENTER = { lat: 55.751244, lng: 37.618423 };

export interface UserLocation {
  lat: number;
  lng: number;
  /** true — координаты не реальные, а дефолт (нет пермишена/недоступно, напр. в web-превью). */
  isFallback: boolean;
}

/**
 * Полноценный флоу запроса пермишена (rationale-экран, обработка "запретил навсегда",
 * deep link в настройки) — ШАГ 9. Здесь — минимум, чтобы гео-фичи (nearby, карта)
 * работали уже сейчас: запросить пермишен, получить точку, иначе — центр Москвы.
 */
export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          if (!cancelled) setLocation({ ...MOSCOW_CENTER, isFallback: true });
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude, isFallback: false });
        }
      } catch {
        if (!cancelled) setLocation({ ...MOSCOW_CENTER, isFallback: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  return { location, loading };
}
