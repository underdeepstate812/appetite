import { useMemo, useState } from "react";
import { LocateFixed, List, Map as MapIcon, RotateCw } from "lucide-react";
import type { OfferCategory } from "@apetite/shared";
import { OffersMap, type MapStyle } from "../components/OffersMap";
import { YandexOffersMap } from "../components/YandexOffersMap";
import { getYandexApiKey, useYandexMaps } from "../hooks/useYandexMaps";
import { OfferSheet } from "../components/OfferSheet";
import { OfferRow } from "../components/OfferRow";
import { FireIcon } from "../components/FireIcon";
import { useGeolocation } from "../hooks/useGeolocation";
import { useNearbyOffers } from "../hooks/useNearbyOffers";
import { useNow } from "../hooks/useNow";
import { usePageTitle } from "../hooks/usePageTitle";
import { CATEGORY_FILTERS } from "../utils/categories";
import { isHotOffer, sortHotFirst } from "../utils/offers";

type MobileView = "map" | "list";

const MAP_STYLE_KEY = "apetite.web.mapStyle";

function readMapStyle(): MapStyle {
  try {
    return localStorage.getItem(MAP_STYLE_KEY) === "satellite" ? "satellite" : "scheme";
  } catch {
    return "scheme";
  }
}

const GEO_MESSAGE = {
  idle: "Показываем центр Санкт-Петербурга",
  locating: "Определяем, где вы…",
  granted: "Предложения рядом с вами",
  denied: "Доступ к геолокации запрещён — разрешите его в настройках браузера",
  unavailable: "Не удалось определить местоположение",
} as const;

export function MapPage() {
  usePageTitle("Карта предложений — Appetite");
  const { location, status: geoStatus, locate } = useGeolocation();
  const [category, setCategory] = useState<OfferCategory | "all">("all");
  const [onlyHot, setOnlyHot] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<MobileView>("map");
  const [mapStyle, setMapStyle] = useState<MapStyle>(readMapStyle);
  // Яндекс.Карты — основная подложка, когда задан ключ; без ключа или при сбое загрузки — запасная Leaflet-карта.
  const yandex = useYandexMaps();
  const now = useNow(30000);

  const { offers, dataKey, error, loading, reload } = useNearbyOffers(location, {
    category: category === "all" ? undefined : category,
  });

  const visible = useMemo(() => {
    const list = (offers ?? []).filter((offer) => !onlyHot || isHotOffer(offer, now));
    return sortHotFirst(list, now);
  }, [offers, onlyHot, now]);

  const selected = visible.find((offer) => offer.id === selectedId) ?? null;
  // Ключ подгонки карты включает «только горящие»: смена этого фильтра тоже должна заново охватить пины.
  const fitKey = `${dataKey}|${onlyHot}`;

  const chooseMapStyle = (next: MapStyle) => {
    setMapStyle(next);
    try {
      localStorage.setItem(MAP_STYLE_KEY, next);
    } catch {
      // выбор просто не запомнится
    }
  };

  const selectOffer = (id: string | null) => {
    setSelectedId(id);
    if (id) setView("map");
  };

  return (
    <main className="map-app" data-view={view} data-sheet={selected ? "open" : "closed"}>
      <aside className="map-panel" aria-label="Список предложений">
        <header className="map-panel-head">
          <h1>Рядом сейчас</h1>
          <p className="map-panel-sub" role="status">
            {offers ? `${visible.length} ${plural(visible.length)} · ` : ""}
            {GEO_MESSAGE[geoStatus]}
          </p>
          {geoStatus !== "granted" && geoStatus !== "locating" && geoStatus !== "denied" ? (
            <button type="button" className="map-locate" onClick={locate}>
              <LocateFixed size={15} aria-hidden="true" /> Определить моё местоположение
            </button>
          ) : null}
        </header>

        <div className="ribbon-filters map-filters" role="tablist" aria-label="Категория">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={category === filter.id}
              className={`ribbon-filter${category === filter.id ? " is-active" : ""}`}
              onClick={() => {
                setCategory(filter.id);
                setSelectedId(null);
              }}
            >
              {filter.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={onlyHot}
            className={`ribbon-filter map-hot-filter${onlyHot ? " is-active" : ""}`}
            onClick={() => setOnlyHot((value) => !value)}
          >
            <FireIcon size={12} /> Горящие
          </button>
        </div>

        <div className="map-list">
          {error ? (
            <div className="map-state" role="alert">
              <p>{error}</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void reload()}>
                <RotateCw size={14} aria-hidden="true" /> Повторить
              </button>
            </div>
          ) : loading && offers === null ? (
            Array.from({ length: 4 }, (_, index) => <div key={index} className="offer-row-skeleton" aria-hidden="true" />)
          ) : visible.length === 0 ? (
            <div className="map-state">
              <p>{onlyHot ? "Горящих предложений сейчас нет." : "Предложений рядом пока нет."}</p>
              <p className="map-state-hint">Загляните позже — витрина обновляется каждую минуту.</p>
            </div>
          ) : (
            visible.map((offer) => (
              <OfferRow
                key={offer.id}
                offer={offer}
                now={now}
                selected={offer.id === selectedId}
                onSelect={() => selectOffer(offer.id)}
              />
            ))
          )}
        </div>
      </aside>

      <section className="map-stage" aria-label="Карта">
        {yandex.status === "loading" ? (
          <div className="offers-map map-loading" role="status">
            <span className="spinner" aria-hidden="true" /> Загружаем карту…
          </div>
        ) : yandex.status === "ready" && yandex.api ? (
          <YandexOffersMap
            api={yandex.api}
            mapStyle={mapStyle}
            center={location}
            userPosition={location.isFallback ? null : location}
            offers={visible}
            selectedId={selectedId}
            onSelect={selectOffer}
            fitKey={fitKey}
          />
        ) : (
          <OffersMap
            mapStyle={mapStyle}
            center={location}
            userPosition={location.isFallback ? null : location}
            offers={visible}
            selectedId={selectedId}
            onSelect={selectOffer}
            fitKey={fitKey}
          />
        )}
        {import.meta.env.DEV && (yandex.status === "failed" || (yandex.status === "off" && !getYandexApiKey())) ? (
          // Только в разработке: иначе подмена карты «молча» выглядит как неработающая функция.
          <p className="map-dev-note" role="note">
            {yandex.status === "failed"
              ? "Яндекс.Карты не загрузились (ключ/сеть) — запасная карта OSM"
              : "Яндекс.Карты выключены: нет VITE_YANDEX_MAPS_API_KEY — запасная карта OSM"}
          </p>
        ) : null}
        <div className="map-style-switch" role="group" aria-label="Вид карты">
          <button type="button" aria-pressed={mapStyle === "scheme"} onClick={() => chooseMapStyle("scheme")}>
            Схема
          </button>
          <button type="button" aria-pressed={mapStyle === "satellite"} onClick={() => chooseMapStyle("satellite")}>
            Спутник
          </button>
        </div>
        {selected ? <OfferSheet offer={selected} onClose={() => setSelectedId(null)} /> : null}
      </section>

      <div className="map-view-toggle" role="group" aria-label="Вид">
        <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>
          <MapIcon size={16} aria-hidden="true" /> Карта
        </button>
        <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
          <List size={16} aria-hidden="true" /> Список
        </button>
      </div>
    </main>
  );
}

function plural(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "предложение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "предложения";
  return "предложений";
}
