import { useEffect, useRef, useState } from "react";
import { getOfferUrgencyRatio, heatColor, type NearbyOffer } from "@apetite/shared";
import { LEAFLET_ATTRIBUTION_PREFIX } from "../utils/leafletAttribution";

const LEAFLET_CSS_ID = "appetite-leaflet-css";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

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
  /**
   * Плавный «дрейф камеры» по замкнутой траектории — карта в мокапе живая, а не стоп-кадр. Жесты при этом
   * по-прежнему отключены (посетитель не должен «утащить» карту вместо скролла страницы). Выключается при
   * prefers-reduced-motion, пока мокап вне экрана и пока вкладка скрыта.
   */
  drift?: boolean;
}

/** Амплитуда и период дрейфа: заметное, но спокойное движение, пины остаются в кадре. */
const DRIFT_AMPLITUDE_X = 60;
const DRIFT_AMPLITUDE_Y = 40;
const DRIFT_PERIOD_MS = 36_000;

/** Положение «камеры» (px от исходной точки) в момент t мс: восьмёрка (фигура Лиссажу 1:2). */
export function driftPosition(t: number): { x: number; y: number } {
  const phase = (2 * Math.PI * t) / DRIFT_PERIOD_MS;
  return { x: DRIFT_AMPLITUDE_X * Math.sin(phase), y: DRIFT_AMPLITUDE_Y * Math.sin(2 * phase) };
}

/**
 * Настоящая карта (OpenStreetMap-тайлы через Leaflet), тот же приём, что и в
 * mobile/LeafletMapView.tsx (dynamic import + DivIcon-маркеры вместо PNG,
 * которые ломаются при резолве пути через бандлер). Здесь карта декоративная —
 * это иллюстрация экрана приложения внутри мокапа телефона, а не рабочий
 * виджет — поэтому жесты (драг/зум/скролл) отключены: посетитель лендинга не
 * должен случайно "утащить" карту вместо скролла страницы.
 */
export function LeafletMapView({ center, zoom = 13, offers, drift = false }: LeafletMapViewProps) {
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
      map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);

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

  // Дрейф камеры. Leaflet округляет panBy до целых пикселей, поэтому дробный сдвиг копим и отдаём целыми
  // порциями — иначе медленное движение (доли пикселя за кадр) просто терялось бы, и карта «не двигалась».
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!drift || !mapReady || !map || !container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let prev = driftPosition(0);
    const acc = { x: 0, y: 0 };
    let onScreen = true;

    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
          })
        : null;
    observer?.observe(container);

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (onScreen && !document.hidden) {
        elapsed += Math.min(dt, 100); // после паузы вкладки не «прыгаем» на накопленное время
        const current = driftPosition(elapsed);
        acc.x += current.x - prev.x;
        acc.y += current.y - prev.y;
        prev = current;
        const dx = Math.trunc(acc.x);
        const dy = Math.trunc(acc.y);
        if (dx !== 0 || dy !== 0) {
          map.panBy([dx, dy], { animate: false });
          acc.x -= dx;
          acc.y -= dy;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [drift, mapReady]);

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
        // Размер пина — от величины скидки (крупный = горячая цена), цвет — от оставшегося
        // времени (та же шкала "жара", что и в мобильном приложении: мята → янтарь → ember →
        // красный в последние ~30 минут) — два независимых сигнала вместо одного смешанного.
        const hot = offer.discountPercent >= 60;
        const size = hot ? 44 : 38;
        const ratio = getOfferUrgencyRatio(offer);
        const color = heatColor(ratio, "light");
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
