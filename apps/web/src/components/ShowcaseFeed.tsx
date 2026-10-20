import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ChevronLeft, ChevronRight, RotateCw, X } from "lucide-react";
import type { NearbyOffer, OfferCategory } from "@apetite/shared";
import { ShowcaseCard } from "./ShowcaseCard";
import { FireIcon } from "./FireIcon";
import { GeoPrompt, GeoStatusLine, type FeedSort, type GeoState } from "./GeoControls";
import { FiltersPanel, type FilterValues } from "./FiltersPanel";
import { useRailDrift } from "../hooks/useRailDrift";
import { CATEGORY_FILTERS } from "../utils/categories";
import { describePriceRange } from "../utils/priceFilter";

/** В ленте — самые горячие и выгодные (список уже отсортирован), остальные — на карте: сорок карточек в ряд не листает никто. */
export const MAX_FEED_CARDS = 16;

const DRIFT_KEY = "apetite.web.feedDrift";

/** Лента едет сама, пока человек не поставил паузу (это запоминается) или система не просит поменьше движения. */
function readPlaying(): boolean {
  if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return localStorage.getItem(DRIFT_KEY) !== "paused";
  } catch {
    return true;
  }
}

interface ShowcaseFeedProps {
  /** Уже отфильтрованные и отсортированные предложения; null — ещё грузим. */
  offers: NearbyOffer[] | null;
  now: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  category: OfferCategory | "all";
  onCategory: (category: OfferCategory | "all") => void;
  onlyHot: boolean;
  onOnlyHot: () => void;
  /** Цена из панели фильтров, целые рубли (null — не задана). */
  minRub: number | null;
  maxRub: number | null;
  /** Применить категорию и цену из панели фильтров. */
  onApplyFilters: (next: FilterValues) => void;
  /** Сбросить ВСЕ фильтры (категория, цена, «Горящие») — для пустой выдачи. */
  onResetFilters: () => void;
  /** Весь набор города до фильтров — для счётчиков в панели фильтров. */
  allOffers: NearbyOffer[] | null;
  selectedId: string | null;
  onSelect: (offerId: string) => void;
  /** Прокрутка к карте ниже. */
  onShowMap: () => void;
  geo: GeoState;
  sort: FeedSort;
  onSort: (sort: FeedSort) => void;
  onLocate: () => void;
  onResetGeo: () => void;
  /** Мягкое приглашение «Показать ближайшие первыми?» — при первом заходе, пока позицию не просили. */
  showGeoPrompt: boolean;
  onDismissGeoPrompt: () => void;
}

export function ShowcaseFeed({
  offers, now, loading, error, onRetry, category, onCategory, onlyHot, onOnlyHot, minRub, maxRub, onApplyFilters, onResetFilters, allOffers, selectedId, onSelect,
  onShowMap, geo, sort, onSort, onLocate, onResetGeo, showGeoPrompt, onDismissGeoPrompt,
}: ShowcaseFeedProps) {
  const railRef = useRef<HTMLUListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const [playing, setPlaying] = useState(readPlaying);
  // Вторая копия карточек для бесшовной петли нужна, только если оригинал заметно шире экрана; иначе копии торчали бы рядом.
  const [loops, setLoops] = useState(false);
  const count = offers?.length ?? 0;
  const shown = offers ? offers.slice(0, MAX_FEED_CARDS) : [];
  const rest = Math.max(0, count - shown.length);
  const itemsKey = shown.map((offer) => offer.id).join(",");

  const [filtersOpen, setFiltersOpen] = useState(false);
  // Пока открыта панель фильтров, лента под ней не уезжает.
  const drift = useRailDrift(railRef, wrapRef, { playing: playing && !filtersOpen, loops, itemsKey });
  const priceActive = minRub !== null || maxRub !== null;
  const anyFilter = category !== "all" || priceActive || onlyHot;

  const togglePlaying = () => {
    setPlaying((value) => {
      try {
        localStorage.setItem(DRIFT_KEY, value ? "paused" : "playing");
      } catch {
        // выбор просто не запомнится
      }
      return !value;
    });
  };

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setEdges({ start: rail.scrollLeft <= 4, end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4 });
  }, []);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) {
      setLoops(false);
      return;
    }
    const update = () => {
      const items = rail.querySelectorAll<HTMLElement>(".showcase-item:not(.is-clone)");
      const first = items[0];
      const last = items[items.length - 1];
      setLoops(!!first && !!last && last.offsetLeft + last.offsetWidth - first.offsetLeft > rail.clientWidth * 1.5);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [itemsKey, loading, error]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    measure();
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      rail.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [measure, count, loading]);

  // Смена фильтра — лента заново с начала.
  useEffect(() => {
    railRef.current?.scrollTo({ left: 0 });
  }, [category, onlyHot]);

  const page = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    rail.scrollBy({ left: direction * Math.max(240, rail.clientWidth * 0.8), behavior });
  };

  return (
    <section className="showcase" aria-labelledby="showcase-title">
      <div className="showcase-inner">
        <FiltersPanel
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          value={{ category, minRub, maxRub }}
          onApply={onApplyFilters}
          offers={allOffers}
          onlyHot={onlyHot}
          now={now}
          drift={{ available: loops, playing, onToggle: togglePlaying }}
        />
        <header className="showcase-head">
          <div className="showcase-titles">
            <p className="showcase-eyebrow">
              <span className="live-dot" aria-hidden="true" /> Сейчас на витрине
            </p>
            <h1 id="showcase-title" className="showcase-title">
              {offers ? `${count} ${plural(count)}` : "Свежие предложения"}
            </h1>
            <GeoStatusLine geo={geo} sort={sort} onSort={onSort} onLocate={onLocate} onReset={onResetGeo} promptShown={showGeoPrompt} />
            {priceActive ? (
              <div className="showcase-active">
                <button type="button" className="geo-chip" onClick={() => onApplyFilters({ category, minRub: null, maxRub: null })} aria-label={`Сбросить фильтр по цене: ${describePriceRange(minRub, maxRub)}`}>
                  Цена {describePriceRange(minRub, maxRub)} <X size={14} aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="showcase-filters">
            {/* «Горящие» — переключатель, а не вкладка: внутри tablist ему не место (axe: aria-required-children). */}
            <div className="showcase-tabs" role="tablist" aria-label="Категория">
              {CATEGORY_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={category === filter.id}
                  className={`ribbon-filter${category === filter.id ? " is-active" : ""}`}
                  onClick={() => onCategory(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={onlyHot}
              className={`ribbon-filter showcase-hot${onlyHot ? " is-active" : ""}`}
              onClick={onOnlyHot}
            >
              <FireIcon size={12} /> Горящие
            </button>
          </div>
        </header>

        {showGeoPrompt ? <GeoPrompt onAllow={onLocate} onDismiss={onDismissGeoPrompt} /> : null}

        <div className="showcase-rail-wrap" ref={wrapRef} {...drift}>
          {error ? (
            <div className="showcase-state" role="alert">
              <p>{error}</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
                <RotateCw size={14} aria-hidden="true" /> Повторить
              </button>
            </div>
          ) : offers === null && loading ? (
            <ul className="showcase-rail" aria-hidden="true" ref={railRef}>
              {Array.from({ length: 5 }, (_, index) => (
                <li key={index} className="show-card-skeleton" />
              ))}
            </ul>
          ) : count === 0 ? (
            <div className="showcase-state">
              <p>{anyFilter ? "По выбранным фильтрам ничего не нашлось." : "Предложений пока нет."}</p>
              {anyFilter ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={onResetFilters}>
                  Сбросить фильтры
                </button>
              ) : (
                <p className="showcase-state-hint">Загляните позже — витрина обновляется каждую минуту.</p>
              )}
            </div>
          ) : (
            <>
              <ul className="showcase-rail" ref={railRef} aria-label="Предложения">
                {shown.map((offer, index) => (
                  <li key={offer.id} className="showcase-item" style={{ "--i": index } as CSSProperties}>
                    <ShowcaseCard offer={offer} now={now} selected={offer.id === selectedId} onSelect={onSelect} />
                  </li>
                ))}
                <EndCard rest={rest} onShowMap={onShowMap} />
                {loops
                  ? [
                      ...shown.map((offer) => (
                        <li key={`${offer.id}-clone`} className="showcase-item is-clone" aria-hidden="true" style={{ "--i": 0 } as CSSProperties}>
                          <ShowcaseCard offer={offer} now={now} selected={offer.id === selectedId} onSelect={onSelect} decorative />
                        </li>
                      )),
                      <EndCard key="end-clone" rest={rest} onShowMap={onShowMap} decorative />,
                    ]
                  : null}
              </ul>
              <div className="showcase-fade showcase-fade-start" data-hidden={edges.start} aria-hidden="true" />
              <div className="showcase-fade showcase-fade-end" data-hidden={edges.end && !loops} aria-hidden="true" />
              <button type="button" className="showcase-arrow showcase-arrow-prev" onClick={() => page(-1)} disabled={edges.start} aria-label="Назад по ленте">
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button type="button" className="showcase-arrow showcase-arrow-next" onClick={() => page(1)} disabled={edges.end && !loops} aria-label="Дальше по ленте">
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/** Последняя карточка ленты: «Все на карте». В копии для петли (decorative) — вне порядка табуляции и скрыта от скринридера. */
function EndCard({ rest, onShowMap, decorative = false }: { rest: number; onShowMap: () => void; decorative?: boolean }) {
  return (
    <li className={`showcase-item showcase-item-end${decorative ? " is-clone" : ""}`} aria-hidden={decorative || undefined}>
      <button type="button" className="show-more" onClick={onShowMap} tabIndex={decorative ? -1 : undefined}>
        <span className="show-more-icon" aria-hidden="true">
          <ArrowDown size={20} strokeWidth={2.4} />
        </span>
        <span className="show-more-title">{rest > 0 ? `Ещё ${rest} на карте` : "Все на карте"}</span>
        <span className="show-more-hint">Метки с фото — горящие</span>
      </button>
    </li>
  );
}

export function plural(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "предложение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "предложения";
  return "предложений";
}
