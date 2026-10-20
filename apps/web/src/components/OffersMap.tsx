import { useCallback, useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { NearbyOffer } from "@apetite/shared";
import { createPinNode } from "../utils/mapPinDom";
import { pinScaleForZoom, pinZIndex } from "../utils/mapPins";
import { LEAFLET_ATTRIBUTION_PREFIX } from "../utils/leafletAttribution";
import { offsetFromSheet, readSheetBox } from "../utils/mapGeo";

export type MapStyle = "scheme" | "satellite";

interface TileSpec {
  url: string;
  options: import("leaflet").TileLayerOptions;
}

/**
 * Запасные слои на Leaflet — без ключей. Рабочая карта — Яндекс (YandexOffersMap.tsx); эти слои включаются,
 * когда ключа Яндекса нет или он не принят. CARTO Voyager проверен и ОТКЛОНЁН: публичные тайлы теперь
 * рисуют водяной знак «API KEY REQUIRED». Подписи Esri латиницей, поэтому для спутника только снимки.
 * ВАЖНО для продакшена: публичные тайл-серверы OSM/Esri рассчитаны на умеренную нагрузку и dev/бету.
 */
const TILE_LAYERS: Record<MapStyle, TileSpec[]> = {
  scheme: [
    {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
    },
  ],
  satellite: [
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      options: { maxZoom: 19, attribution: "Tiles © Esri — Maxar, Earthstar Geographics, GIS User Community" },
    },
  ],
};

interface OffersMapProps {
  mapStyle?: MapStyle;
  center: { lat: number; lng: number };
  /** Реальная позиция пользователя — точка «Вы здесь». null, пока работаем на центре города по умолчанию. */
  userPosition: { lat: number; lng: number } | null;
  offers: NearbyOffer[];
  /** Предложения, под которые подгоняется вид при смене набора данных (например, ближайшие к человеку). По умолчанию — все. */
  focus?: NearbyOffer[];
  selectedId: string | null;
  onSelect: (offerId: string | null) => void;
  /** Ключ набора данных (центр + фильтр), для которого загружены offers: при смене карта заново подгоняется, на тихом автообновлении — нет. */
  fitKey: string;
}

type LeafletModule = typeof import("leaflet");

function pinIcon(L: LeafletModule, offer: NearbyOffer, selected: boolean, scale: number) {
  const { node, width, height } = createPinNode(offer, selected, Date.now(), scale);
  return L.divIcon({
    className: "map-pin-host",
    html: node,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
  });
}

/** Метки выступают над точкой на свою высоту (+ бейдж скидки), поэтому сверху оставляем больше, чем по бокам и снизу. */
function fitPadding(width: number): { paddingTopLeft: [number, number]; paddingBottomRight: [number, number] } {
  const narrow = width < 520;
  const side = narrow ? 40 : 72;
  return { paddingTopLeft: [side, 84], paddingBottomRight: [side, narrow ? 44 : 56] };
}

const WHEEL_HINT = /Mac|iPhone|iPad/.test(typeof navigator === "undefined" ? "" : navigator.platform) ? "⌘ + прокрутка — масштаб карты" : "Ctrl + прокрутка — масштаб карты";
const TOUCH_HINT = "Двигайте карту двумя пальцами";
const HINT_MS = 1600;

/**
 * Рабочая карта: OpenStreetMap-тайлы через Leaflet (бесплатно, без ключа), кликабельные пины с
 * подсветкой выбранного, точка пользователя. Отдельный компонент от LeafletMapView — тот декоративный
 * (мокап телефона на лендинге, жесты отключены), здесь жесты, зум и клики — основная функция.
 */
export function OffersMap({ mapStyle = "scheme", center, userPosition, offers, focus, selectedId, onSelect, fitKey }: OffersMapProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const markersRef = useRef(new Map<string, { marker: import("leaflet").Marker; offer: NearbyOffer }>());
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const tileLayersRef = useRef<import("leaflet").TileLayer[]>([]);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selectedId);
  const focusRef = useRef(focus);
  const scaleRef = useRef(1);
  const lastFitKey = useRef<string | null>(null);
  const hintTimer = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  // Текст остаётся, пока подсказка гаснет: иначе при затухании она «схлопывалась» бы в пустую плашку.
  const [hint, setHint] = useState({ text: "", visible: false });

  const showHint = useCallback((text: string) => {
    setHint({ text, visible: true });
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint((previous) => ({ ...previous, visible: false })), HINT_MS);
  }, []);

  onSelectRef.current = onSelect;
  selectedRef.current = selectedId;
  focusRef.current = focus;

  /** Метки на общем виде города мельче (см. pinScaleForZoom): перерисовываем набор, когда зум перешёл на другую ступень. */
  const refreshIcons = useCallback(() => {
    const L = leafletRef.current;
    if (!L) return;
    markersRef.current.forEach(({ marker, offer }, id) => {
      marker.setIcon(pinIcon(L, offer, id === selectedRef.current, scaleRef.current));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      // Карта лежит внутри прокручиваемой страницы (под лентой), поэтому она не должна «съедать» жесты прокрутки:
      // на телефоне одним пальцем страница листается, картой двигают двумя (pinch-zoom остаётся), на десктопе
      // колесо листает страницу, а масштаб — с Ctrl/⌘ (и щипок на трекпаде).
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        dragging: !L.Browser.mobile,
        scrollWheelZoom: true,
        // Дробный зум: подгонка границ не «прыгает» на целый уровень и использует всю площадь карты, а не 40% её.
        zoomSnap: 0.25,
      }).setView([center.lat, center.lng], 13);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
      // Клик по пустому месту закрывает карточку оффера — привычный жест карт.
      map.on("click", () => onSelectRef.current(null));
      scaleRef.current = pinScaleForZoom(map.getZoom());
      map.on("zoomend", () => {
        const next = pinScaleForZoom(map.getZoom());
        if (next === scaleRef.current) return;
        scaleRef.current = next;
        refreshIcons();
      });
      mapRef.current = map;
      setMapReady(true);
      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      cancelled = true;
      window.clearTimeout(hintTimer.current);
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      userMarkerRef.current = null;
      tileLayersRef.current = [];
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Подсказки «кооперативных жестов» (см. создание карты). Колесо без Ctrl/⌘ глушим ещё на захвате у оболочки —
  // до обработчика Leaflet; preventDefault не вызываем, поэтому страница прокручивается как обычно.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !mapReady) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      event.stopPropagation();
      showHint(WHEEL_HINT);
    };
    let start: { x: number; y: number } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      start = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!start || event.touches.length !== 1) return;
      const dx = Math.abs(event.touches[0].clientX - start.x);
      const dy = Math.abs(event.touches[0].clientY - start.y);
      // Подсказка — только если палец тянет «вбок»: чисто вертикальный свайп — это обычная прокрутка страницы, ей подсказка не нужна.
      if (dx > 14 && dx * 2 >= dy) {
        start = null;
        if (mapRef.current && !mapRef.current.dragging.enabled()) showHint(TOUCH_HINT);
      }
    };
    shell.addEventListener("wheel", onWheel, { capture: true, passive: true });
    shell.addEventListener("touchstart", onTouchStart, { passive: true });
    shell.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      shell.removeEventListener("wheel", onWheel, { capture: true });
      shell.removeEventListener("touchstart", onTouchStart);
      shell.removeEventListener("touchmove", onTouchMove);
    };
  }, [mapReady, showHint]);

  // Подложка: ставится после создания карты и заменяется при переключении «Схема/Спутник».
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;
    tileLayersRef.current.forEach((layer) => layer.remove());
    tileLayersRef.current = TILE_LAYERS[mapStyle].map((spec, index) => {
      const layer = L.tileLayer(spec.url, spec.options).addTo(map);
      // Подписи спутника — поверх снимков, но под пинами.
      if (index > 0) layer.setZIndex(5);
      return layer;
    });
  }, [mapStyle, mapReady]);

  // Контейнер меняет размер при переключении «Карта/Список» на мобильном и при ресайзе окна.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Пины: пересобираем набор при смене офферов (в т.ч. тихом автообновлении раз в минуту).
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    offers.forEach((offer) => {
      const selected = offer.id === selectedRef.current;
      const marker = L.marker([offer.businessLat, offer.businessLng], {
        icon: pinIcon(L, offer, selected, scaleRef.current),
        title: `${offer.title} — ${offer.businessName}, −${offer.discountPercent}%`,
        alt: offer.title,
        zIndexOffset: pinZIndex(offer, selected),
        keyboard: true,
      }).addTo(map);
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectRef.current(offer.id);
      });
      // Метка получает фокус (tabindex, role=button), но Leaflet не превращает Enter/Пробел в клик — с клавиатуры
      // предложение открыть было нельзя. Иконка (divIcon) при смене вида переиспользуется, так что обработчик остаётся.
      marker.getElement()?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectRef.current(offer.id);
        }
      });
      markersRef.current.set(offer.id, { marker, offer });
    });

    // Подгоняем границы только при смене набора данных (фильтр/центр), а не при каждом минутном
    // обновлении: иначе карта «прыгала» бы из-под пальца, пока пользователь её двигает.
    if (lastFitKey.current !== fitKey) {
      lastFitKey.current = fitKey;
      if (offers.length > 0) {
        const fitOffers = focusRef.current && focusRef.current.length > 0 ? focusRef.current : offers;
        const points: [number, number][] = fitOffers.map((o) => [o.businessLat, o.businessLng]);
        if (userPosition) points.push([userPosition.lat, userPosition.lng]);
        map.fitBounds(L.latLngBounds(points), { ...fitPadding(map.getSize().x), maxZoom: 15, animate: false });
      } else {
        map.setView([center.lat, center.lng], 13, { animate: false });
      }
    }
  }, [offers, mapReady, fitKey, userPosition, center.lat, center.lng]);

  // Подсветка выбранного пина + плавный переезд к нему (пан без смены зума, если уже достаточно близко).
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;
    markersRef.current.forEach(({ marker, offer }, id) => {
      const selected = id === selectedId;
      marker.setIcon(pinIcon(L, offer, selected, scaleRef.current));
      marker.setZIndexOffset(pinZIndex(offer, selected));
    });
    const current = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (current) {
      // Карточка оффера закрывает часть карты (слева на десктопе, снизу на телефоне) — сдвигаем центр так,
      // чтобы выбранный пин оказался в середине видимой части, а не под карточкой.
      const zoom = Math.max(map.getZoom(), 15);
      const size = map.getSize();
      const { dx, dy } = offsetFromSheet(size.x, size.y, readSheetBox(map.getContainer()));
      const target = map.project(current.marker.getLatLng(), zoom).add([-dx, dy]);
      map.flyTo(map.unproject(target, zoom), zoom, { duration: 0.6 });
    }
  }, [selectedId, mapReady]);

  // Точка пользователя.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!userPosition) return;
    userMarkerRef.current = L.marker([userPosition.lat, userPosition.lng], {
      icon: L.divIcon({
        className: "map-pin-host",
        html: '<div class="map-me"><span></span></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: -500,
    }).addTo(map);
  }, [userPosition, mapReady]);

  return (
    <div ref={shellRef} className="offers-map-shell">
      <div ref={containerRef} className="offers-map" role="application" aria-label="Карта предложений" />
      <p className={`map-hint${hint.visible ? " is-visible" : ""}`} role="status" aria-live="polite" aria-hidden={!hint.visible}>
        {hint.text}
      </p>
    </div>
  );
}
