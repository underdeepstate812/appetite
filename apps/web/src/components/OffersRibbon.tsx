import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { UtensilsCrossed, Croissant, Flower2, ShoppingBasket, Heart, MapPin, Clock } from "lucide-react";
import { useReveal } from "../hooks/useReveal";
import { FireIcon } from "./FireIcon";

type Category = "food" | "bakery" | "flowers" | "groceries";

interface Offer {
  id: string;
  category: Category;
  shop: string;
  title: string;
  oldPrice: number;
  price: number;
  discount: number;
  distance: string;
  pickup: string;
  /** Минут до конца окна самовывоза на момент загрузки страницы — тикает вживую. */
  minutesLeft: number;
}

/**
 * "Горит" — не ручной флаг, а живое правило: большая скидка + мало времени.
 * Считается от текущего обратного отсчёта, так что оффер может реально
 * загореться прямо на экране, пока пользователь смотрит на ленту.
 */
const HOT_DISCOUNT_THRESHOLD = 60;
const HOT_MINUTES_THRESHOLD = 45;

const CATEGORY_META: Record<Category, { label: string; icon: typeof UtensilsCrossed }> = {
  food: { label: "Еда", icon: UtensilsCrossed },
  bakery: { label: "Выпечка", icon: Croissant },
  flowers: { label: "Цветы", icon: Flower2 },
  groceries: { label: "Продукты", icon: ShoppingBasket },
};

const FILTERS: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "food", label: "Еда" },
  { id: "bakery", label: "Выпечка" },
  { id: "flowers", label: "Цветы" },
  { id: "groceries", label: "Продукты" },
];

const OFFERS: Offer[] = [
  { id: "1", category: "food", shop: "Никитская кухня", title: "Бизнес-ланч: суп + горячее", oldPrice: 490, price: 343, discount: 30, distance: "450 м", pickup: "до 21:30", minutesLeft: 90 },
  { id: "2", category: "food", shop: "Padang Wok", title: "Сет: лапша с курицей терияки", oldPrice: 690, price: 210, discount: 70, distance: "1.1 км", pickup: "через 40 мин", minutesLeft: 40 },
  { id: "3", category: "bakery", shop: "Sonnig Bakery", title: "Круассаны и багеты, набор", oldPrice: 340, price: 150, discount: 55, distance: "650 м", pickup: "до 20:00", minutesLeft: 120 },
  { id: "4", category: "bakery", shop: "Хлеб и Соль", title: "Пироги с ягодами, 2 шт", oldPrice: 420, price: 250, discount: 40, distance: "900 м", pickup: "до 22:00", minutesLeft: 150 },
  { id: "5", category: "flowers", shop: "Полевой цветочный", title: "Букет дня — микс сезонных", oldPrice: 1490, price: 890, discount: 40, distance: "1.4 км", pickup: "до 21:00", minutesLeft: 100 },
  { id: "6", category: "flowers", shop: "GreenHouse Flowers", title: "Моно-букет: пионы", oldPrice: 2200, price: 660, discount: 70, distance: "2 км", pickup: "через 25 мин", minutesLeft: 25 },
  { id: "7", category: "groceries", shop: "Свежий Корнер", title: "Овощи и фрукты, набор дня", oldPrice: 650, price: 260, discount: 60, distance: "300 м", pickup: "до 21:45", minutesLeft: 46 },
  { id: "8", category: "groceries", shop: "Маркет Дня", title: "Молочная линейка, набор", oldPrice: 380, price: 210, discount: 45, distance: "800 м", pickup: "до 20:30", minutesLeft: 80 },
];

/**
 * Живая лента реальных офферов — тянет драгом/скроллом, фильтруется по
 * категории, карточки можно сохранить (heart). Не декорация: состояние
 * фильтра и лайков реально меняет то, что видно на экране.
 */
export function OffersRibbon() {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const headerRef = useReveal<HTMLDivElement>();
  const stripRef = useReveal<HTMLDivElement>();

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startScroll: number; dragging: boolean }>({
    startX: 0,
    startScroll: 0,
    dragging: false,
  });

  const visible = useMemo(() => (filter === "all" ? OFFERS : OFFERS.filter((o) => o.category === filter)), [filter]);
  const animatedCount = useAnimatedCount(visible.length);

  // Лента дублируется, чтобы петля была бесшовной: как только автоскролл
  // проходит первую копию целиком, мы отматываем scrollLeft ровно на её
  // ширину назад — визуально это неотличимо от продолжения бегущей строки.
  const loopedOffers = useMemo(() => [...visible, ...visible], [visible]);

  const isHoveredRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [filter]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const SPEED = 0.5; // px за кадр (~30px/с при 60fps) — читаемый темп бегущей строки
    let raf = 0;

    const tick = () => {
      if (!isHoveredRef.current && !dragState.current.dragging) {
        const half = el.scrollWidth / 2;
        el.scrollLeft += SPEED;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loopedOffers]);

  const toggleLike = (id: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePointerEnter = () => {
    isHoveredRef.current = true;
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    isHoveredRef.current = false;
    endDrag(event);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = { startX: event.clientX, startScroll: el.scrollLeft, dragging: true };
    el.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || !dragState.current.dragging) return;
    el.scrollLeft = dragState.current.startScroll - (event.clientX - dragState.current.startX);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    scrollRef.current?.releasePointerCapture(event.pointerId);
  };

  return (
    <section style={{ padding: "72px 0 96px" }}>
      <div className="container">
        <div
          ref={headerRef}
          className="reveal"
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 28 }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="live-dot" aria-hidden="true" />
              <span className="eyebrow">Сейчас на витрине</span>
            </div>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 32px)" }}>
              {animatedCount} {pluralOffer(animatedCount)} рядом с тобой
            </h2>
          </div>

          <div className="ribbon-filters" role="tablist" aria-label="Фильтр по категориям">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={`ribbon-filter${filter === f.id ? " is-active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={stripRef} className="reveal ribbon-viewport">
          <div
            ref={scrollRef}
            className="ribbon-scroll"
            onPointerEnter={handlePointerEnter}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerLeave={handlePointerLeave}
          >
            {loopedOffers.map((offer, index) => {
              const isDuplicate = index >= visible.length;
              return (
                <OfferTile
                  key={`${offer.id}-${index}`}
                  offer={offer}
                  index={index % visible.length}
                  liked={liked.has(offer.id)}
                  onToggleLike={() => toggleLike(offer.id)}
                  duplicate={isDuplicate}
                />
              );
            })}
          </div>
          <div className="ribbon-fade ribbon-fade-left" aria-hidden="true" />
          <div className="ribbon-fade ribbon-fade-right" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function OfferTile({
  offer,
  index,
  liked,
  onToggleLike,
  duplicate,
}: {
  offer: Offer;
  index: number;
  liked: boolean;
  onToggleLike: () => void;
  duplicate?: boolean;
}) {
  const meta = CATEGORY_META[offer.category];
  const Icon = meta.icon;

  // Тикаем только те офферы, что вообще способны загореться — незачем
  // гонять интервал у карточки со скидкой 40%, она никогда не станет "hot".
  const tracked = offer.discount >= HOT_DISCOUNT_THRESHOLD;
  const secondsLeft = useCountdown(offer.minutesLeft, tracked);
  const hot = tracked && secondsLeft <= HOT_MINUTES_THRESHOLD * 60;

  return (
    <article
      className={`offer-tile${hot ? " is-hot" : ""}`}
      style={{ "--tile-delay": `${Math.min(index, 6) * 60}ms` } as CSSProperties}
      aria-hidden={duplicate || undefined}
    >
      {hot ? (
        <span className="offer-tile-hot">
          <FireIcon size={13} /> Горит
        </span>
      ) : null}

      <button
        type="button"
        tabIndex={duplicate ? -1 : undefined}
        className={`offer-tile-like${liked ? " is-liked" : ""}`}
        onClick={onToggleLike}
        aria-pressed={liked}
        aria-label={liked ? "Убрать из избранного" : "Сохранить в избранное"}
      >
        <Heart size={16} strokeWidth={2.2} fill={liked ? "currentColor" : "none"} />
      </button>

      <div className={`offer-tile-photo${hot ? " is-hot" : ""}`}>
        <span className="offer-tile-photo-plate" aria-hidden="true">
          <Icon size={32} strokeWidth={1.5} color={hot ? "var(--color-danger)" : "var(--color-primary)"} aria-hidden="true" />
        </span>
        <span className="offer-tile-logo" aria-hidden="true">
          {offer.shop.charAt(0)}
        </span>
      </div>

      <p className="offer-tile-shop">{offer.shop}</p>
      <p className="offer-tile-title">{offer.title}</p>

      <div className="offer-tile-price-row">
        <span className="offer-tile-price">{offer.price} ₽</span>
        <span className="offer-tile-old-price">{offer.oldPrice} ₽</span>
        <span className={`offer-tile-badge${hot ? " is-hot" : ""}`}>−{offer.discount}%</span>
      </div>

      <div className="offer-tile-meta">
        <span>
          <MapPin size={12} strokeWidth={2.2} aria-hidden="true" /> {offer.distance}
        </span>
        {hot ? (
          <span className="offer-tile-countdown">
            <FireIcon size={12} /> {formatCountdown(secondsLeft)}
          </span>
        ) : (
          <span>
            <Clock size={12} strokeWidth={2.2} aria-hidden="true" /> {offer.pickup}
          </span>
        )}
      </div>
    </article>
  );
}

/**
 * Живой обратный отсчёт от minutesLeft — тикает раз в секунду, пока tracked.
 * От него зависит и текст таймера на "горящих" карточках, и сам момент,
 * когда обычная карточка пересекает порог и реально становится "hot".
 */
function useCountdown(minutesLeft: number, tracked: boolean) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.round(minutesLeft * 60));

  useEffect(() => {
    if (!tracked || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [tracked]);

  return secondsLeft;
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Счётчик, который переигрывает анимацию при каждом изменении target (а не
 * только один раз при появлении во вьюпорте, как useCountUp) — нужен, чтобы
 * число реально пересчитывалось при переключении фильтра категории.
 */
function useAnimatedCount(target: number) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (fromRef.current === target) return;
    const from = fromRef.current;
    fromRef.current = target;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const duration = 400;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(from + (target - from) * progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return value;
}

function pluralOffer(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "предложение";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "предложения";
  return "предложений";
}
