import { useCallback, useEffect, useState } from "react";
import { Linking } from "react-native";
import * as Location from "expo-location";
import { usersApi } from "../api/users";

/** Центр Санкт-Петербурга (пилот, ШАГ 0) — фолбэк, если геопермишен не выдан/недоступен. */
const SPB_CENTER = { lat: 59.9311, lng: 30.3609 };

export interface UserLocation {
  lat: number;
  lng: number;
  /** true — координаты не реальные, а дефолт (нет пермишена/недоступно, напр. в web-превью). */
  isFallback: boolean;
}

export type LocationPermissionStatus = "undetermined" | "denied" | "blocked" | "granted";

function toStatus(permission: Location.LocationPermissionResponse): LocationPermissionStatus {
  if (permission.status === Location.PermissionStatus.GRANTED) return "granted";
  // canAskAgain === false — пользователь выбрал "не спрашивать больше" (iOS) или
  // "запретить навсегда" (Android): системный диалог больше не появится, нужен deep link в Settings.
  return permission.canAskAgain ? "denied" : "blocked";
}

/**
 * Разрешение НЕ запрашивается автоматически при монтировании — только читается текущий
 * статус, чтобы системный диалог не выскакивал раньше, чем пользователь увидит объяснение
 * (rationale-баннер, см. LocationPermissionBanner). Пока разрешения нет — гео-фичи (nearby,
 * карта) уже работают на фолбэке (центр Санкт-Петербурга), а не блокируются в состоянии загрузки.
 */
export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<LocationPermissionStatus>("undetermined");
  const [loading, setLoading] = useState(true);

  const applyPermission = useCallback(async (permission: Location.LocationPermissionResponse) => {
    setStatus(toStatus(permission));
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      setLocation({ ...SPB_CENTER, isFallback: true });
      return;
    }
    try {
      const position = await Location.getCurrentPositionAsync({});
      const next: UserLocation = { lat: position.coords.latitude, lng: position.coords.longitude, isFallback: false };
      setLocation(next);
      // Бэкенду нужна последняя позиция для гео-дайджеста "рядом с тобой N предложений" (ШАГ 6);
      // не блокируем UI её результатом — обновление best-effort.
      void usersApi.updateLocation(next.lat, next.lng).catch(() => {});
    } catch {
      setLocation({ ...SPB_CENTER, isFallback: true });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        if (cancelled) return;
        await applyPermission(permission);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyPermission]);

  const requestPermission = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    await applyPermission(permission);
  }, [applyPermission]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { location, loading, status, requestPermission, openSettings };
}
