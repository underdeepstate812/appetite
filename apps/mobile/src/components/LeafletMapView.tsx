import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NearbyOffer } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";
import { heatColor } from "../theme/heat";
import { getOfferUrgencyRatio } from "@apetite/shared";
import { useNow } from "../hooks/useNow";
import { LEAFLET_ATTRIBUTION_PREFIX } from "../utils/leafletAttribution";

const LEAFLET_CSS_ID = "apetite-leaflet-css";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const PULSE_STYLE_ID = "apetite-marker-pulse";
const MAP_STYLE_ID = "apetite-map-chrome";

/** Чем больше скидка, тем крупнее и "горячее" пульсирует пин — см. бриф про "живой радар скидок". */
function pinTierFor(discountPercent: number) {
  if (discountPercent >= 50) return { dot: 22, glow: 16, duration: "1.4s" };
  if (discountPercent >= 30) return { dot: 18, glow: 10, duration: "1.9s" };
  return { dot: 14, glow: 6, duration: "2.6s" };
}

function ensureStyles() {
  if (!document.getElementById(PULSE_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = PULSE_STYLE_ID;
    style.textContent = `
      @keyframes apetitePinPulse {
        0% { box-shadow: 0 0 0 0 var(--pin-glow-color); }
        70% { box-shadow: 0 0 0 var(--pin-glow-spread) transparent; }
        100% { box-shadow: 0 0 0 0 transparent; }
      }
      @keyframes apetiteMePulse {
        0% { transform: scale(0.6); opacity: 0.9; }
        100% { transform: scale(2.4); opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .apetite-marker div, .apetite-me div { animation: none !important; }
      }
    `;
    document.head.appendChild(style);
  }
  if (!document.getElementById(MAP_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = MAP_STYLE_ID;
    // Только для карты на весь экран (.apetite-map-fill): стеклянный зум под кнопкой «список», атрибуция OSM поверх ленты
    // карточек (по лицензии она должна быть видна), в тёмной теме тайлы приглушены, чтобы карта не слепила рядом с тёмным UI.
    style.textContent = `
      .apetite-map-fill .leaflet-bottom { margin-bottom: var(--map-bottom-inset, 0px); }
      .apetite-map-fill .leaflet-top.leaflet-right { margin-top: var(--map-top-inset, 0px); }
      .apetite-map-fill .leaflet-control-zoom { border: 0 !important; border-radius: 22px; overflow: hidden; box-shadow: 0 6px 20px rgba(22,32,30,0.18) !important; backdrop-filter: blur(14px); margin-right: 12px !important; }
      .apetite-map-fill .leaflet-control-zoom a { width: 44px !important; height: 44px !important; line-height: 44px !important; font-size: 20px; background: rgba(255,255,255,0.88); color: #16201e; }
      .apetite-map-fill .leaflet-control-zoom a + a { border-top: 1px solid rgba(22,32,30,0.1); }
      .apetite-map-fill .leaflet-control-attribution { background: rgba(255,255,255,0.78) !important; border-radius: 8px 0 0 0; padding: 2px 6px; }
      .apetite-map-dark .leaflet-tile-pane { filter: brightness(0.74) contrast(1.06) saturate(0.82); }
      .apetite-map-dark .leaflet-control-zoom a { background: rgba(18,26,25,0.88); color: #edf5f3; }
      .apetite-map-dark .leaflet-control-attribution { background: rgba(18,26,25,0.78) !important; color: #93a7a2; }
      .apetite-map-dark .leaflet-control-attribution a { color: #5eead4; }
      .apetite-marker:focus-visible, .apetite-marker:focus { outline: 3px solid #2dd4bf; outline-offset: 3px; border-radius: 12px; }
    `;
    document.head.appendChild(style);
  }
}

type LatLng = { lat: number; lng: number };

interface LeafletMapViewProps {
  center: LatLng;
  offers: NearbyOffer[];
  onSelectOffer: (offerId: string) => void;
  height?: number;
  /** Занять всё место родителя (карта на весь экран) вместо фиксированной высоты (превью на главной). */
  fill?: boolean;
  /** Выбранное предложение: его пин крупнее и с кольцом. */
  selectedId?: string | null;
  /** Карта летит к выбранному пину (после первого выбора человеком). До этого выбор только подсвечивается. */
  followSelection?: boolean;
  /** Позиция человека — точка «вы здесь». */
  userPosition?: LatLng | null;
  /** Высота полосы внизу, закрытой карточками, и верхняя — под плавающей шапкой: центр пина и подгонка вида учитывают их. */
  bottomInset?: number;
  topInset?: number;
  /** Точки, под которые подгоняется вид при смене fitKey (обычно — самые горячие/ближайшие предложения). */
  fitPoints?: LatLng[];
  fitKey?: string;
  /** Растёт на каждое «вернуться ко мне»: карта летит к userPosition. */
  recenterKey?: number;
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
 *
 * Режим `fill` — карта на весь экран с лентой карточек поверх: пины связаны с лентой (выбор подсвечивается и ведёт
 * карту), вид подгоняется под первые карточки с учётом закрытых плашками полос, атрибуция OSM поднята над лентой.
 */
export function LeafletMapView({
  center,
  offers,
  onSelectOffer,
  height = 280,
  fill = false,
  selectedId = null,
  followSelection = false,
  userPosition = null,
  bottomInset = 0,
  topInset = 0,
  fitPoints,
  fitKey,
  recenterKey = 0,
}: LeafletMapViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow();
  const containerRef = useRef<View>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markersRef = useRef(new Map<string, { marker: import("leaflet").Marker; offer: NearbyOffer }>());
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const onSelectRef = useRef(onSelectOffer);
  const selectedRef = useRef(selectedId);
  const insetsRef = useRef({ top: topInset, bottom: bottomInset });
  const lastFitKey = useRef<string | null>(null);
  // Карта создаётся асинхронно (dynamic import) — без этого флага эффект, который
  // расставляет маркеры, успевает отработать и выйти (mapRef.current ещё null) до
  // того, как карта готова, и больше не перезапускается: маркеры просто не появляются.
  const [mapReady, setMapReady] = useState(false);

  onSelectRef.current = onSelectOffer;
  selectedRef.current = selectedId;
  insetsRef.current = { top: topInset, bottom: bottomInset };

  useEffect(() => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement("link");
      link.id = LEAFLET_CSS_ID;
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }
    ensureStyles();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled) return;
      // View на web рендерится в обычный DOM-элемент — ref указывает на него напрямую.
      const domNode = containerRef.current as unknown as HTMLDivElement | null;
      if (!domNode || mapRef.current) return;

      leafletRef.current = L;
      const map = L.map(domNode, { attributionControl: true, zoomControl: !fill }).setView([center.lat, center.lng], 13);
      if (fill) L.control.zoom({ position: "topright" }).addTo(map);
      map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      // Клик по пустому месту ничего не снимает: у ленты карточек всегда есть выбранная.
      mapRef.current = map;
      setMapReady(true);
      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      userMarkerRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Размер контейнера меняется (поворот, клавиатура, адресная строка мобильного браузера) — карта пересчитывает размеры.
  useEffect(() => {
    const node = containerRef.current as unknown as HTMLDivElement | null;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Тема и закрытые полосы → CSS-переменные контейнера (тёмные тайлы, атрибуция над лентой, зум под шапкой).
  useEffect(() => {
    const node = containerRef.current as unknown as HTMLDivElement | null;
    if (!node) return;
    node.classList.toggle("apetite-map-fill", fill);
    node.classList.toggle("apetite-map-dark", theme.mode === "dark");
    node.style.setProperty("--map-bottom-inset", `${bottomInset}px`);
    node.style.setProperty("--map-top-inset", `${topInset + 56}px`);
  }, [fill, theme.mode, bottomInset, topInset, mapReady]);

  // Центр меняется, когда наконец приходит реальная геопозиция (после фолбэка на Санкт-Петербург) — только у превью.
  useEffect(() => {
    if (fill) return;
    mapRef.current?.setView([center.lat, center.lng]);
  }, [center.lat, center.lng, fill]);

  // Пины.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    offers.forEach((offer) => {
      const marker = L.marker([offer.businessLat, offer.businessLng], {
        icon: pinIcon(L, offer, offer.id === selectedRef.current, now, theme),
        title: `${offer.title} — ${offer.businessName}, −${offer.discountPercent}%`,
        alt: offer.title,
        keyboard: true,
        zIndexOffset: offer.id === selectedRef.current ? 1000 : offer.discountPercent,
      }).addTo(map);
      marker.on("click", () => onSelectRef.current(offer.id));
      // Метка фокусируется (tabindex, role=button), но Leaflet не превращает Enter/Пробел в клик — с клавиатуры открыть было нельзя.
      marker.getElement()?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectRef.current(offer.id);
        }
      });
      markersRef.current.set(offer.id, { marker, offer });
    });
  }, [offers, theme, mapReady, now]);

  // Выбор: подсветка пина + (после первого выбора человеком) плавный перелёт с учётом закрытых полос.
  const lastFlownId = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;
    markersRef.current.forEach(({ marker, offer }, id) => {
      const selected = id === selectedId;
      marker.setIcon(pinIcon(L, offer, selected, now, theme));
      marker.setZIndexOffset(selected ? 1000 : offer.discountPercent);
    });
    const current = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (!current || !followSelection || lastFlownId.current === selectedId) return;
    lastFlownId.current = selectedId;
    const zoom = Math.max(map.getZoom(), 15);
    const { top, bottom } = insetsRef.current;
    const shift = (bottom - top) / 2; // пин — в середину видимой полосы между шапкой и лентой
    const target = map.project(current.marker.getLatLng(), zoom).add([0, shift]);
    map.flyTo(map.unproject(target, zoom), zoom, { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, followSelection, mapReady]);

  // Первый вид (и новый набор данных): охватываем первые карточки, а не весь город.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady || !fill || !fitPoints || fitPoints.length === 0) return;
    const key = fitKey ?? String(fitPoints.length);
    if (lastFitKey.current === key) return;
    lastFitKey.current = key;
    const points: [number, number][] = fitPoints.map((p) => [p.lat, p.lng]);
    if (userPosition) points.push([userPosition.lat, userPosition.lng]);
    const { top, bottom } = insetsRef.current;
    // Метка выступает над точкой на свою высоту, поэтому сверху оставляем больше, чем по бокам.
    map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [40, top + 70], paddingBottomRight: [40, bottom + 30], maxZoom: 15, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, fitPoints, mapReady, fill]);

  // Точка человека.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!userPosition) return;
    userMarkerRef.current = L.marker([userPosition.lat, userPosition.lng], {
      icon: L.divIcon({
        className: "apetite-me",
        html: `<div style="position:relative;width:22px;height:22px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:${theme.colors.primary}55;animation:apetiteMePulse 2.2s ease-out infinite;"></div>
          <div style="position:absolute;inset:5px;border-radius:50%;background:${theme.colors.primary};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: -500,
    }).addTo(map);
  }, [userPosition, mapReady, theme]);

  // «Вернуться ко мне».
  const lastRecenter = useRef(recenterKey);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || recenterKey === lastRecenter.current) return;
    lastRecenter.current = recenterKey;
    if (!userPosition) return;
    const zoom = Math.max(map.getZoom(), 15);
    const { top, bottom } = insetsRef.current;
    const target = map.project([userPosition.lat, userPosition.lng], zoom).add([0, (bottom - top) / 2]);
    map.flyTo(map.unproject(target, zoom), zoom, { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey, mapReady]);

  const style = fill ? { flex: 1, minHeight: 0 } : { height, borderRadius: theme.radii.md, overflow: "hidden" as const };
  return <View ref={containerRef} style={style} accessibilityLabel={t("map.mapLabel")} />;
}

function pinIcon(L: typeof import("leaflet"), offer: NearbyOffer, selected: boolean, now: number, theme: ReturnType<typeof useTheme>) {
  const tier = pinTierFor(offer.discountPercent);
  // Цвет пина — от оставшегося времени (та же шкала "жара", что у OfferCard/FuseTimer):
  // мята — времени много, дальше янтарь, ember, и красный только в последние ~30 минут.
  // Размер/скорость пульса — отдельный сигнал, от величины скидки (pinTierFor).
  const ratio = getOfferUrgencyRatio(offer, now);
  const dotColor = heatColor(ratio, theme.mode);
  const glowColor = `${dotColor}80`; // ~50% alpha для стартового кольца пульса
  const dot = selected ? tier.dot + 8 : tier.dot;
  const ring = selected ? `box-shadow:0 0 0 4px #fff,0 0 0 7px ${dotColor},0 6px 16px rgba(0,0,0,0.35);` : "";
  const pulse = selected ? "" : `animation:apetitePinPulse ${tier.duration} ease-out infinite;`;
  const labelBg = selected ? theme.colors.text : theme.colors.surfaceElevated;
  const labelFg = selected ? theme.colors.background : theme.colors.text;
  return L.divIcon({
    className: "apetite-marker",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:${selected ? 6 : 2}px;">
        <div style="
          width:${dot}px;
          height:${dot}px;
          border-radius:50%;
          background:radial-gradient(circle at 35% 30%, ${dotColor}, ${dotColor});
          border:2px solid ${theme.colors.background};
          --pin-glow-color:${glowColor};
          --pin-glow-spread:${tier.glow}px;
          ${pulse}${ring}
        "></div>
        <div style="
          background:${labelBg};
          color:${labelFg};
          border-radius:10px;
          padding:${selected ? "2px 8px" : "1px 6px"};
          font-size:${selected ? 13 : 11}px;
          font-weight:700;
          font-family:system-ui,sans-serif;
          white-space:nowrap;
          box-shadow:0 1px 4px rgba(0,0,0,0.25);
        ">−${offer.discountPercent}%</div>
      </div>`,
    iconAnchor: [dot / 2, dot / 2],
  });
}
