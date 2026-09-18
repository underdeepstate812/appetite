import { useEffect, useRef, useState } from "react";
import type { NearbyOffer } from "@apetite/shared";

const LEAFLET_CSS_ID = "appetite-leaflet-css";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const HOT_DISCOUNT_THRESHOLD = 60;

function ensureLeafletCss() {
  if (document.getElementById(LEAFLET_CSS_ID)) return;
  const link = document.createElement("link");
  link.id = LEAFLET_CSS_ID;
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS_URL;
  document.head.appendChild(link);
}

interface LeafletMapViewProps {
  /**
   * Центр и зум вынесены пропом, а не зашиты внутрь компонента — сейчас вызывающий
   * код (PhoneMockup) всегда передаёт центр Петербурга, но когда сервис выйдет в
   * другие регионы, для показа "карты рядом с тобой" достаточно передать другой
   * center (например, из геолокации посетителя лендинга или выбранного города) —
   * сам компонент менять не придётся.
   */
  center: { lat: number; lng: number };
  zoom?: number;
  offers: NearbyOffer[];
}

/**
 * Настоящая карта (OpenStreetMap-тайлы через Leaflet), тот же приём, что и в
 * mobile/LeafletMapView.tsx (dynamic import + DivIcon-маркеры вместо PNG,
 * которые ломаются при резолве пути через бандлер). Здесь карта декоративная —
 * это иллюстрация экрана приложения внутри мокапа телефона, а не рабочий
 * виджет — поэтому жесты (драг/зум/скролл) отключены: посетитель лендинга не
 * должен случайно "утащить" карту вместо скролла страницы.
 */
export function LeafletMapView({ center, zoom = 13, offers }: LeafletMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    ensureLeafletCss();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        attributionControl: true,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
      }).setView([center.lat, center.lng], zoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
      // Контейнер получает финальный размер уже после первого рендера (aspect-ratio
      // родителя) — без пересчёта тайлы иногда остаются нарезаны под нулевой размер.
      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setView([center.lat, center.lng], zoom);
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      offers.forEach((offer) => {
        const hot = offer.discountPercent >= HOT_DISCOUNT_THRESHOLD;
        const size = hot ? 44 : 38;
        const color = hot ? "var(--color-danger)" : "var(--color-primary)";
        const icon = L.divIcon({
          className: "appetite-phone-marker",
          html: `
            <div style="
              width:${size}px;height:${size}px;
              border-radius:50% 50% 50% 0;
              border:2.5px solid var(--color-background);
              transform:rotate(-45deg);
              background:${color};
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 4px 10px rgba(18,16,13,0.25);
            ">
              <span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:${hot ? 11 : 10}px;font-family:var(--font-body);">
                −${offer.discountPercent}%
              </span>
            </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size],
        });
        const marker = L.marker([offer.businessLat, offer.businessLng], { icon, interactive: false }).addTo(map);
        markersRef.current.push(marker);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [offers, mapReady]);

  // z-index (не auto) обязателен: иначе высокие внутренние z-index Leaflet-панелей
  // (маркеры, тайлы — сотни) "протекают" мимо этого контейнера и рисуются поверх
  // хедера/bottom sheet телефона, у которых z-index не создаёт свой stacking context.
  return <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />;
}
