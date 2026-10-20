import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OfferCategory } from "@apetite/shared";
import { OffersMap, type MapStyle } from "../components/OffersMap";
import { YandexOffersMap } from "../components/YandexOffersMap";
import { getYandexApiKey, useYandexMaps } from "../hooks/useYandexMaps";
import { OfferSheet } from "../components/OfferSheet";
import { ShowcaseFeed } from "../components/ShowcaseFeed";
import { MapLocateButton, type FeedSort } from "../components/GeoControls";
import { useGeolocation, type UserLocation } from "../hooks/useGeolocation";
import { DEFAULT_RADIUS_KM, useNearbyOffers } from "../hooks/useNearbyOffers";
import { useNow } from "../hooks/useNow";
import { usePageTitle } from "../hooks/usePageTitle";
import { SPB_CENTER, distanceKm, isInCoverage } from "../utils/geo";
import { filterOffers, sanitizeCategory, sortHotFirst, sortNearestFirst } from "../utils/offers";
import type { FilterValues } from "../components/FiltersPanel";

const MAP_STYLE_KEY = "apetite.web.mapStyle";

function readMapStyle(): MapStyle {
  try {
    return localStorage.getItem(MAP_STYLE_KEY) === "satellite" ? "satellite" : "scheme";
  } catch {
    return "scheme";
  }
}

const GEO_PROMPT_KEY = "apetite.web.geoPrompt";
/** Столько ближайших предложений охватывает карта при открытии «рядом со мной»: район, а не весь город. */
const NEAR_FOCUS_COUNT = 8;
const CITY: UserLocation = { ...SPB_CENTER, isFallback: true };

function readPromptDismissed(): boolean {
  try {
    return localStorage.getItem(GEO_PROMPT_KEY) === "dismissed";
  } catch {
    return false;
  }
}

/**
 * Главная после входа: сверху лента «Сейчас на витрине» — самые горячие и выгодные предложения города, ниже —
 * они же на карте. Фильтры (категория, «Горящие») общие: лента и карта всегда показывают один и тот же набор.
 * Нажатие на карточку ленты открывает предложение на карте и подводит страницу к ней.
 */
export function HomePage() {
  usePageTitle("Сейчас на витрине — Appetite");
  const geo = useGeolocation();
  const [category, setCategory] = useState<OfferCategory | "all">("all");
  const [onlyHot, setOnlyHot] = useState(false);
  const [price, setPrice] = useState<{ minRub: number | null; maxRub: number | null }>({ minRub: null, maxRub: null });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>(readMapStyle);
  const [sort, setSort] = useState<FeedSort>("hot");
  const [focusNonce, setFocusNonce] = useState(0);
  const [promptDismissed, setPromptDismissed] = useState(readPromptDismissed);
  // Яндекс.Карты — основная подложка, когда задан ключ; без ключа или при сбое загрузки — запасная Leaflet-карта.
  const yandex = useYandexMaps();
  const now = useNow(30000);

  // Позиция человека за пределами города бесполезна для витрины (в радиусе пусто) — для него показываем город целиком.
  const hasFix = !geo.location.isFallback;
  const inCity = hasFix && isInCoverage(geo.location);
  const located = inCity;
  const outside = hasFix && !inCity;
  const center = located ? geo.location : CITY;
  // Из пригорода (до 60 км от центра) радиус по умолчанию не дотянулся бы до города — расширяем так, чтобы он охватывал весь город.
  const radiusKm = located ? Math.min(100, Math.ceil(distanceKm(geo.location, SPB_CENTER)) + DEFAULT_RADIUS_KM) : DEFAULT_RADIUS_KM;

  // Категория и цена фильтруются на клиенте (см. filterOffers): набор города небольшой, зато счётчики в панели фильтров точные,
  // а смена фильтра мгновенная и не перетряхивает карту запросом.
  const { offers, dataKey, error, loading, reload } = useNearbyOffers(center, { radiusKm });

  // Позиция появилась — витрина сразу «ближайшие первыми» (за этим человек и разрешал геолокацию); пропала — снова «горящие».
  const wasLocated = useRef(false);
  useEffect(() => {
    if (located && !wasLocated.current) setSort("near");
    if (!located && wasLocated.current) setSort("hot");
    wasLocated.current = located;
  }, [located]);

  const visible = useMemo(() => {
    if (offers === null) return null;
    const list = filterOffers(offers, { category, ...price, onlyHot }, now);
    return located && sort === "near" ? sortNearestFirst(list, now) : sortHotFirst(list, now);
  }, [offers, category, price, onlyHot, now, located, sort]);

  // Карта при открытии «рядом со мной» охватывает человека и ближайшие к нему предложения — район, а не весь город.
  const focus = useMemo(() => (located && visible ? sortNearestFirst(visible, now).slice(0, NEAR_FOCUS_COUNT) : undefined), [located, visible, now]);

  const selected = visible?.find((offer) => offer.id === selectedId) ?? null;
  // Ключ подгонки карты: набор данных (центр, радиус), фильтры (категория, цена, «только горящие») и явная просьба «вернуться ко мне».
  const fitKey = `${dataKey}|${category}|${price.minRub ?? ""}-${price.maxRub ?? ""}|${onlyHot}|${focusNonce}`;

  const chooseMapStyle = (next: MapStyle) => {
    setMapStyle(next);
    try {
      localStorage.setItem(MAP_STYLE_KEY, next);
    } catch {
      // выбор просто не запомнится
    }
  };

  const stageRef = useRef<HTMLDivElement>(null);

  const scrollTo = (element: Element | null) => {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    element?.scrollIntoView({ behavior, block: "start" });
  };
  // «Все на карте» подводит к заголовку секции; выбор карточки — сразу к самой карте (под шапку), чтобы на невысоком
  // телефоне метка и шторка предложения поместились в экран целиком.
  const showMap = useCallback(() => scrollTo(document.getElementById("map")), []);
  const selectFromFeed = useCallback((id: string) => {
    setSelectedId(id);
    scrollTo(stageRef.current);
  }, []);

  const dismissGeoPrompt = () => {
    setPromptDismissed(true);
    try {
      localStorage.setItem(GEO_PROMPT_KEY, "dismissed");
    } catch {
      // приглашение просто покажется ещё раз
    }
  };

  // Кнопка на карте: с известной позицией — вернуть вид к человеку (и тихо обновить позицию), без неё — запросить.
  const locateFromMap = () => {
    if (located) setFocusNonce((value) => value + 1);
    geo.locate();
  };

  const changeCategory = (next: OfferCategory | "all") => {
    setCategory(sanitizeCategory(next));
    setSelectedId(null);
  };

  const applyFilters = (next: FilterValues) => {
    // Последний рубеж: панель уже проверила ввод, но в состояние попадают только настоящая категория и согласованная цена.
    setCategory(sanitizeCategory(next.category));
    const swap = next.minRub !== null && next.maxRub !== null && next.minRub > next.maxRub;
    setPrice(swap ? { minRub: next.maxRub, maxRub: next.minRub } : { minRub: next.minRub, maxRub: next.maxRub });
    setSelectedId(null);
  };

  const resetFilters = () => {
    setCategory("all");
    setPrice({ minRub: null, maxRub: null });
    setOnlyHot(false);
    setSelectedId(null);
  };

  const mapOffers = visible ?? [];

  return (
    <main className="home">
      <ShowcaseFeed
        offers={visible}
        now={now}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        category={category}
        onCategory={changeCategory}
        onlyHot={onlyHot}
        onOnlyHot={() => setOnlyHot((value) => !value)}
        minRub={price.minRub}
        maxRub={price.maxRub}
        onApplyFilters={applyFilters}
        onResetFilters={resetFilters}
        allOffers={offers}
        selectedId={selectedId}
        onSelect={selectFromFeed}
        onShowMap={showMap}
        geo={{ status: geo.status, located, outside }}
        sort={sort}
        onSort={setSort}
        onLocate={geo.locate}
        onResetGeo={geo.reset}
        showGeoPrompt={geo.status === "idle" && !promptDismissed}
        onDismissGeoPrompt={dismissGeoPrompt}
      />

      <section id="map" className="home-map" aria-labelledby="home-map-title" data-sheet={selected ? "open" : "closed"}>
        <div className="home-map-head">
          <h2 id="home-map-title">На карте</h2>
          <div className="map-style-switch" role="group" aria-label="Вид карты">
            <button type="button" aria-pressed={mapStyle === "scheme"} onClick={() => chooseMapStyle("scheme")}>
              Схема
            </button>
            <button type="button" aria-pressed={mapStyle === "satellite"} onClick={() => chooseMapStyle("satellite")}>
              Спутник
            </button>
          </div>
          <p className="home-map-hint">Цвет метки — сколько осталось времени. Кружок с фото — горящее предложение.</p>
        </div>

        <div className="map-stage" ref={stageRef}>
          {yandex.status === "loading" ? (
            <div className="offers-map map-loading" role="status">
              <span className="spinner" aria-hidden="true" /> Загружаем карту…
            </div>
          ) : yandex.status === "ready" && yandex.api ? (
            <YandexOffersMap
              api={yandex.api}
              mapStyle={mapStyle}
              center={center}
              userPosition={located ? geo.location : null}
              offers={mapOffers}
              focus={focus}
              selectedId={selectedId}
              onSelect={setSelectedId}
              fitKey={fitKey}
            />
          ) : (
            <OffersMap
              mapStyle={mapStyle}
              center={center}
              userPosition={located ? geo.location : null}
              offers={mapOffers}
              focus={focus}
              selectedId={selectedId}
              onSelect={setSelectedId}
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
          <MapLocateButton status={geo.status} located={located} onClick={locateFromMap} />
          {selected ? <OfferSheet offer={selected} onClose={() => setSelectedId(null)} /> : null}
        </div>
      </section>
    </main>
  );
}
