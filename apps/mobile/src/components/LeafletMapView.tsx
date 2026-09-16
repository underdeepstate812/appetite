import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import type { NearbyOffer } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";

const LEAFLET_CSS_ID = "apetite-leaflet-css";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

interface LeafletMapViewProps {
  center: { lat: number; lng: number };
  offers: NearbyOffer[];
  onSelectOffer: (offerId: string) => void;
  height?: number;
}

/**
 * Настоящая интерактивная карта (OpenStreetMap-тайлы через Leaflet) — бесплатно,
 * без API-ключа и регистрации аккаунта (в отличие от Yandex Maps JS API, который
 * требует создать Yandex-аккаунт/ключ — не то, что можно сделать за пользователя).
 * Только web: react-native-maps не имеет web-реализации (см. MapScreen.web.tsx),
 * а Leaflet — DOM-библиотека, на native её не подключить.
 *
 * DivIcon-маркеры вместо стандартных PNG-иконок Leaflet — у дефолтных иконок
 * классическая проблема резолва пути картинки через бандлер; свои маркеры и
 * брендированы цветом темы, и не зависят от способа сборки.
 */
export function LeafletMapView({ center, offers, onSelectOffer, height = 280 }: LeafletMapViewProps) {
  const theme = useTheme();
  const containerRef = useRef<View>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").Marker[]>([]);
  // Карта создаётся асинхронно (dynamic import) — без этого флага эффект, который
  // расставляет маркеры, успевает отработать и выйти (mapRef.current ещё null) до
  // того, как карта готова, и больше не перезапускается: маркеры просто не появляются.
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement("link");
      link.id = LEAFLET_CSS_ID;
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled) return;
      // View на web рендерится в обычный DOM-элемент — ref указывает на него напрямую.
      const domNode = containerRef.current as unknown as HTMLDivElement | null;
      if (!domNode || mapRef.current) return;

      const map = L.map(domNode, { attributionControl: true }).setView([center.lat, center.lng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Центр меняется, когда наконец приходит реальная геопозиция (после фолбэка на Москву).
  useEffect(() => {
    mapRef.current?.setView([center.lat, center.lng]);
  }, [center.lat, center.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      offers.forEach((offer) => {
        const icon = L.divIcon({
          className: "apetite-marker",
          html: `<div style="
            background:${theme.colors.primary};
            color:${theme.colors.onPrimary};
            border:2px solid ${theme.colors.background};
            border-radius:14px;
            padding:3px 8px;
            font-size:12px;
            font-weight:700;
            font-family:system-ui,sans-serif;
            white-space:nowrap;
            box-shadow:0 1px 4px rgba(0,0,0,0.3);
          ">−${offer.discountPercent}%</div>`,
          iconAnchor: [16, 14],
        });
        const marker = L.marker([offer.businessLat, offer.businessLng], { icon }).addTo(map);
        marker.bindTooltip(`${offer.title} · ${offer.businessName}`);
        marker.on("click", () => onSelectOffer(offer.id));
        markersRef.current.push(marker);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [offers, theme, onSelectOffer, mapReady]);

  return <View ref={containerRef} style={{ height, borderRadius: theme.radii.md, overflow: "hidden" }} />;
}
