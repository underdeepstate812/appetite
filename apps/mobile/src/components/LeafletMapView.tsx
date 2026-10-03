import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import type { NearbyOffer } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";
import { heatColor } from "../theme/heat";
import { getOfferUrgencyRatio } from "@apetite/shared";
import { useNow } from "../hooks/useNow";
import { LEAFLET_ATTRIBUTION_PREFIX } from "../utils/leafletAttribution";

const LEAFLET_CSS_ID = "apetite-leaflet-css";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const PULSE_STYLE_ID = "apetite-marker-pulse";

/** Чем больше скидка, тем крупнее и "горячее" пульсирует пин — см. бриф про "живой радар скидок". */
function pinTierFor(discountPercent: number) {
  if (discountPercent >= 50) return { dot: 22, glow: 16, duration: "1.4s" };
  if (discountPercent >= 30) return { dot: 18, glow: 10, duration: "1.9s" };
  return { dot: 14, glow: 6, duration: "2.6s" };
}

function ensurePulseKeyframes() {
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes apetitePinPulse {
      0% { box-shadow: 0 0 0 0 var(--pin-glow-color); }
      70% { box-shadow: 0 0 0 var(--pin-glow-spread) transparent; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }
  `;
  document.head.appendChild(style);
}

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
  const now = useNow();
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
    ensurePulseKeyframes();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled) return;
      // View на web рендерится в обычный DOM-элемент — ref указывает на него напрямую.
      const domNode = containerRef.current as unknown as HTMLDivElement | null;
      if (!domNode || mapRef.current) return;

      const map = L.map(domNode, { attributionControl: true }).setView([center.lat, center.lng], 13);
      map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
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

  // Центр меняется, когда наконец приходит реальная геопозиция (после фолбэка на Санкт-Петербург).
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
        const tier = pinTierFor(offer.discountPercent);
        // Цвет пина — от оставшегося времени (та же шкала "жара", что у OfferCard/FuseTimer):
        // мята — времени много, дальше янтарь, ember, и красный только в последние ~30 минут.
        // Размер/скорость пульса — отдельный сигнал, от величины скидки (pinTierFor).
        const ratio = getOfferUrgencyRatio(offer, now);
        const dotColor = heatColor(ratio, theme.mode);
        const glowColor = `${dotColor}80`; // ~50% alpha для стартового кольца пульса
        const icon = L.divIcon({
          className: "apetite-marker",
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
              <div style="
                width:${tier.dot}px;
                height:${tier.dot}px;
                border-radius:50%;
                background:radial-gradient(circle at 35% 30%, ${dotColor}, ${dotColor});
                border:2px solid ${theme.colors.background};
                --pin-glow-color:${glowColor};
                --pin-glow-spread:${tier.glow}px;
                animation:apetitePinPulse ${tier.duration} ease-out infinite;
              "></div>
              <div style="
                background:${theme.colors.surfaceElevated};
                color:${theme.colors.text};
                border-radius:10px;
                padding:1px 6px;
                font-size:11px;
                font-weight:700;
                font-family:system-ui,sans-serif;
                white-space:nowrap;
                box-shadow:0 1px 4px rgba(0,0,0,0.25);
              ">−${offer.discountPercent}%</div>
            </div>`,
          iconAnchor: [tier.dot / 2, tier.dot / 2],
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
  }, [offers, theme, onSelectOffer, mapReady, now]);

  return <View ref={containerRef} style={{ height, borderRadius: theme.radii.md, overflow: "hidden" }} />;
}
