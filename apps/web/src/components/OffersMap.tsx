import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { NearbyOffer } from "@apetite/shared";
import { pinSpec } from "../utils/mapPins";
import { LEAFLET_ATTRIBUTION_PREFIX } from "../utils/leafletAttribution";

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
  selectedId: string | null;
  onSelect: (offerId: string | null) => void;
  /** Ключ набора данных (центр + фильтр), для которого загружены offers: при смене карта заново подгоняется, на тихом автообновлении — нет. */
  fitKey: string;
}

type LeafletModule = typeof import("leaflet");

function pinIcon(L: LeafletModule, offer: NearbyOffer, selected: boolean) {
  const { size, color, fontSize, text, featured } = pinSpec(offer, selected);
  return L.divIcon({
    className: "map-pin-host",
    html: `<div class="map-pin${selected ? " is-selected" : ""}${featured ? " is-featured" : ""}" style="width:${size}px;height:${size}px;background:${color}"><span style="font-size:${fontSize}px">${text}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

/**
 * Рабочая карта: OpenStreetMap-тайлы через Leaflet (бесплатно, без ключа), кликабельные пины с
 * подсветкой выбранного, точка пользователя. Отдельный компонент от LeafletMapView — тот декоративный
 * (мокап телефона на лендинге, жесты отключены), здесь жесты, зум и клики — основная функция.
 */
export function OffersMap({ mapStyle = "scheme", center, userPosition, offers, selectedId, onSelect, fitKey }: OffersMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const markersRef = useRef(new Map<string, { marker: import("leaflet").Marker; offer: NearbyOffer }>());
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const tileLayersRef = useRef<import("leaflet").TileLayer[]>([]);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selectedId);
  const lastFitKey = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  onSelectRef.current = onSelect;
  selectedRef.current = selectedId;

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(
        [center.lat, center.lng],
        13
      );
      L.control.zoom({ position: "bottomright" }).addTo(map);
      map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION_PREFIX);
      // Клик по пустому месту закрывает карточку оффера — привычный жест карт.
      map.on("click", () => onSelectRef.current(null));
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
      tileLayersRef.current = [];
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        icon: pinIcon(L, offer, selected),
        title: `${offer.title} — ${offer.businessName}, −${offer.discountPercent}%`,
        alt: offer.title,
        zIndexOffset: selected ? 1000 : offer.featured ? 900 : offer.discountPercent,
        keyboard: true,
      }).addTo(map);
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectRef.current(offer.id);
      });
      markersRef.current.set(offer.id, { marker, offer });
    });

    // Подгоняем границы только при смене набора данных (фильтр/центр), а не при каждом минутном
    // обновлении: иначе карта «прыгала» бы из-под пальца, пока пользователь её двигает.
    if (lastFitKey.current !== fitKey) {
      lastFitKey.current = fitKey;
      if (offers.length > 0) {
        const points: [number, number][] = offers.map((o) => [o.businessLat, o.businessLng]);
        if (userPosition) points.push([userPosition.lat, userPosition.lng]);
        map.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: 15, animate: false });
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
      marker.setIcon(pinIcon(L, offer, selected));
      marker.setZIndexOffset(selected ? 1000 : offer.featured ? 900 : offer.discountPercent);
    });
    const current = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (current) {
      // Карточка оффера закрывает часть карты (слева на десктопе, снизу на телефоне) — сдвигаем центр так,
      // чтобы выбранный пин оказался в видимой части, а не под карточкой.
      const zoom = Math.max(map.getZoom(), 15);
      const size = map.getSize();
      const wide = size.x > 700;
      const target = map.project(current.marker.getLatLng(), zoom).add([wide ? -Math.min(210, size.x * 0.22) : 0, wide ? 0 : size.y * 0.2]);
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

  return <div ref={containerRef} className="offers-map" role="application" aria-label="Карта предложений" />;
}
