import { useEffect, useState } from "react";
import type { YMaps3 } from "../types/ymaps3";
import { loadYandexMaps } from "../utils/loadYandexMaps";

export type YandexStatus = "off" | "loading" | "ready" | "failed";

/** Ключ API задаётся при сборке (VITE_YANDEX_MAPS_API_KEY); без него работает запасная карта. */
export function getYandexApiKey(): string | undefined {
  const key = (import.meta.env.VITE_YANDEX_MAPS_API_KEY as string | undefined)?.trim();
  return key ? key : undefined;
}

/**
 * Состояние подключения Яндекс.Карт. `?provider=osm` принудительно выключает Яндекс — быстрый способ
 * сравнить с запасной картой или обойти проблему с ключом, не правя .env.
 */
export function useYandexMaps(): { status: YandexStatus; api: YMaps3 | null } {
  const key = getYandexApiKey();
  const forcedOff = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("provider") === "osm";
  const enabled = !!key && !forcedOff;
  const [state, setState] = useState<{ status: YandexStatus; api: YMaps3 | null }>({
    status: enabled ? "loading" : "off",
    api: null,
  });

  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    loadYandexMaps(key).then(
      (api) => !cancelled && setState({ status: "ready", api }),
      (error) => {
        console.warn("[map] Яндекс.Карты недоступны, включена запасная карта:", error instanceof Error ? error.message : error);
        if (!cancelled) setState({ status: "failed", api: null });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, key]);

  return state;
}
