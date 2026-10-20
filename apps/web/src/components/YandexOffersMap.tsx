import { useEffect, useRef, useState } from "react";
import type { NearbyOffer } from "@apetite/shared";
import type { LngLat, YMapInstance, YMaps3, YMarkerInstance } from "../types/ymaps3";
import type { MapStyle } from "./OffersMap";
import { offsetFromSheet, readSheetBox, shiftedCenter } from "../utils/mapGeo";
import { createPinNode } from "../utils/mapPinDom";
import { pinScaleForZoom, pinZIndex } from "../utils/mapPins";

interface Props {
  api: YMaps3;
  mapStyle: MapStyle;
  center: { lat: number; lng: number };
  userPosition: { lat: number; lng: number } | null;
  offers: NearbyOffer[];
  /** Предложения, под которые подгоняется вид при смене набора данных (например, ближайшие к человеку). По умолчанию — все. */
  focus?: NearbyOffer[];
  selectedId: string | null;
  onSelect: (offerId: string | null) => void;
  /** Ключ набора данных (центр + фильтр): при смене карта заново подгоняется, на тихом автообновлении — нет. */
  fitKey: string;
}

/** Поля карты при подгонке под метки: сверху больше — метки выступают над точкой на свою высоту (+ бейдж скидки). */
function fitMargin(width: number): [number, number, number, number] {
  const narrow = width < 520;
  const side = narrow ? 40 : 72;
  return [84, side, narrow ? 44 : 56, side];
}
const MAX_FIT_ZOOM = 15;
/** Клик по пину не должен ещё и «закрыть» карточку клик-обработчиком самой карты. */
const MARKER_CLICK_GUARD_MS = 200;

function buildPin(offer: NearbyOffer, onActivate: () => void): HTMLDivElement {
  const anchor = document.createElement("div");
  anchor.className = "ymap-anchor";
  anchor.setAttribute("role", "button");
  anchor.tabIndex = 0;
  anchor.setAttribute("aria-label", `${offer.title} — ${offer.businessName}, −${offer.discountPercent}%`);
  anchor.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  });
  return anchor;
}

/** Перерисовывает содержимое якоря (капля или кружок с фото); сам якорь с обработчиками остаётся тем же. */
function applyPin(anchor: HTMLDivElement, offer: NearbyOffer, selected: boolean, scale: number) {
  anchor.replaceChildren(createPinNode(offer, selected, Date.now(), scale).node);
}

/**
 * Рабочая карта на Яндекс.Картах (JS API 3.0): подробная схема Санкт-Петербурга с русскими подписями и
 * спутник. Тот же контракт, что у Leaflet-версии (OffersMap): пины со скидкой и «жаром», подсветка выбранного,
 * точка пользователя. Логотип и копирайт Яндекса рисует сам API — их нельзя скрывать (условия использования).
 */
export function YandexOffersMap({ api, mapStyle, center, userPosition, offers, focus, selectedId, onSelect, fitKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const baseLayerRef = useRef<unknown>(null);
  const markersRef = useRef(new Map<string, { marker: YMarkerInstance; anchor: HTMLDivElement; offer: NearbyOffer }>());
  const userMarkerRef = useRef<{ marker: unknown } | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selectedId);
  const focusRef = useRef(focus);
  const scaleRef = useRef(1);
  const lastFitKey = useRef<string | null>(null);
  const lastMarkerClick = useRef(0);
  const [mapReady, setMapReady] = useState(false);

  onSelectRef.current = onSelect;
  selectedRef.current = selectedId;
  focusRef.current = focus;

  // Создание/уничтожение карты.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new api.YMap(container, { location: { center: [center.lng, center.lat], zoom: 13 }, margin: fitMargin(container.clientWidth) });
    map.addChild(new api.YMapDefaultFeaturesLayer({}));
    // Клик по пустому месту закрывает карточку оффера — привычный жест карт.
    map.addChild(
      new api.YMapListener({
        layer: "any",
        onClick: (object) => {
          if (object || Date.now() - lastMarkerClick.current < MARKER_CLICK_GUARD_MS) return;
          onSelectRef.current(null);
        },
        // На общем виде города метки мельче (см. pinScaleForZoom): перерисовываем, когда зум перешёл на другую ступень.
        onUpdate: ({ location }) => {
          const next = pinScaleForZoom(location.zoom);
          if (next === scaleRef.current) return;
          scaleRef.current = next;
          markersRef.current.forEach(({ anchor, offer }, id) => applyPin(anchor, offer, id === selectedRef.current, next));
        },
      })
    );
    mapRef.current = map;
    setMapReady(true);

    // Кнопки зума — из пакета Яндекса; если он не подгрузился, карта остаётся рабочей (колесо/жесты).
    let cancelled = false;
    api
      .import("@yandex/ymaps3-default-ui-theme")
      .then((theme) => {
        if (cancelled || !theme.YMapZoomControl) return;
        const controls = new api.YMapControls({ position: "right" });
        controls.addChild(new theme.YMapZoomControl({}));
        map.addChild(controls);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      map.destroy();
      mapRef.current = null;
      baseLayerRef.current = null;
      markersRef.current.clear();
      userMarkerRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // Подложка: схема или спутник.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (baseLayerRef.current) map.removeChild(baseLayerRef.current);
    const layer = mapStyle === "satellite" ? new api.YMapDefaultSatelliteLayer({}) : new api.YMapDefaultSchemeLayer({});
    baseLayerRef.current = layer;
    map.addChild(layer);
  }, [api, mapStyle, mapReady]);

  // Пины: пересобираем набор при смене офферов (в т.ч. при тихом автообновлении раз в минуту).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach(({ marker }) => map.removeChild(marker));
    markersRef.current.clear();

    offers.forEach((offer) => {
      const activate = () => {
        lastMarkerClick.current = Date.now();
        onSelectRef.current(offer.id);
      };
      const anchor = buildPin(offer, activate);
      const selected = offer.id === selectedRef.current;
      applyPin(anchor, offer, selected, scaleRef.current);
      const marker = new api.YMapMarker(
        { coordinates: [offer.businessLng, offer.businessLat], zIndex: pinZIndex(offer, selected), onClick: activate },
        anchor
      );
      map.addChild(marker);
      markersRef.current.set(offer.id, { marker, anchor, offer });
    });

    // Подгоняем границы только при смене набора данных, а не при каждом минутном обновлении:
    // иначе карта «прыгала» бы из-под пальца, пока пользователь её двигает.
    if (lastFitKey.current !== fitKey) {
      lastFitKey.current = fitKey;
      const fitOffers = focusRef.current && focusRef.current.length > 0 ? focusRef.current : offers;
      const points: LngLat[] = fitOffers.map((o) => [o.businessLng, o.businessLat]);
      if (userPosition) points.push([userPosition.lng, userPosition.lat]);
      if (points.length === 0) {
        map.update({ location: { center: [center.lng, center.lat], zoom: 13, duration: 0 } });
      } else {
        const lngs = points.map((p) => p[0]);
        const lats = points.map((p) => p[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        // Одна точка (или кучка в пару десятков метров) — границы схлопнулись, API ушёл бы в максимальный зум.
        if (maxLng - minLng < 0.002 && maxLat - minLat < 0.001) {
          map.update({ location: { center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2], zoom: MAX_FIT_ZOOM, duration: 0 } });
        } else {
          map.update({ location: { bounds: [[minLng, minLat], [maxLng, maxLat]], duration: 0 } });
        }
      }
    }
  }, [api, offers, mapReady, fitKey, userPosition, center.lat, center.lng]);

  // Подсветка выбранного пина + плавный переезд к нему (со сдвигом из-под карточки оффера).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markersRef.current.forEach(({ marker, anchor, offer }, id) => {
      const selected = id === selectedId;
      applyPin(anchor, offer, selected, scaleRef.current);
      marker.update({ zIndex: pinZIndex(offer, selected) });
    });
    const current = selectedId ? markersRef.current.get(selectedId) : undefined;
    const container = containerRef.current;
    if (!current || !container) return;
    // Карточка закрывает часть карты (слева на десктопе, снизу на телефоне) — центр сдвигаем так, чтобы пин был
    // в середине видимой части.
    const zoom = 16;
    const { dx, dy } = offsetFromSheet(container.clientWidth, container.clientHeight, readSheetBox(container));
    const [lng, lat] = shiftedCenter(current.offer.businessLat, current.offer.businessLng, zoom, dx, dy);
    map.update({ location: { center: [lng, lat], zoom, duration: 600 } });
  }, [selectedId, mapReady]);

  // Точка пользователя.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (userMarkerRef.current) map.removeChild(userMarkerRef.current.marker);
    userMarkerRef.current = null;
    if (!userPosition) return;
    const anchor = document.createElement("div");
    anchor.className = "ymap-anchor ymap-anchor-center";
    anchor.setAttribute("aria-hidden", "true");
    anchor.innerHTML = '<div class="map-me"><span></span></div>';
    const marker = new api.YMapMarker({ coordinates: [userPosition.lng, userPosition.lat], zIndex: 1 }, anchor);
    map.addChild(marker);
    userMarkerRef.current = { marker };
  }, [api, userPosition, mapReady]);

  return <div ref={containerRef} className="offers-map offers-map-yandex" role="application" aria-label="Карта предложений" />;
}
