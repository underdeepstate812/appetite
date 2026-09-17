import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import type { UserLocation } from "./useLocation";

/**
 * Человекочитаемая геометка для хедера ("📍 Тверская р-н" вместо голых координат) —
 * реверс-геокодинг best-effort: на web / без реального пермишена просто возвращает
 * фолбэк-строку, на native пробует Location.reverseGeocodeAsync один раз на смену
 * координат и молча деградирует до фолбэка при ошибке (нет сети/квоты и т.п.).
 */
export function useLocationLabel(location: UserLocation | null, fallbackLabel: string): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!location) {
      setLabel(null);
      return;
    }
    if (location.isFallback || Platform.OS === "web") {
      setLabel(fallbackLabel);
      return;
    }

    let cancelled = false;
    setLabel(null);

    Location.reverseGeocodeAsync({ latitude: location.lat, longitude: location.lng })
      .then(([place]) => {
        if (cancelled) return;
        const readable = place?.district || place?.street || place?.city || null;
        setLabel(readable ?? fallbackLabel);
      })
      .catch(() => {
        if (!cancelled) setLabel(fallbackLabel);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng, location?.isFallback, fallbackLabel]);

  return label;
}
