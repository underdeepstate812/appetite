import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { UtensilsCrossed, Croissant, Flower2, ShoppingBasket, Heart, MapPin, Clock, Zap, Check, Pause, Play } from "lucide-react";
import { useReveal } from "../hooks/useReveal";
import { FireIcon } from "./FireIcon";
import { OneClickDialog } from "./OneClickDialog";
import { useAuth } from "../store/auth";
import { useShowcaseOffers, type RibbonOffer, type ShowcaseCategory } from "../hooks/useShowcaseOffers";
import { formatRub } from "../utils/format";
import { grantOneClickConsent, hasOneClickConsent, writePaymentMethod } from "../utils/paymentPrefs";
import { placeOrder } from "../utils/placeOrder";
import burgerPhoto from "../assets/offers/burger.jpg";
import carbonaraPhoto from "../assets/offers/carbonara.jpg";
import caesarSaladPhoto from "../assets/offers/caesar-salad.jpg";
import friesPhoto from "../assets/offers/fries.jpg";
import pokePhoto from "../assets/offers/poke-salmon-mango.jpg";
import cappuccinoShakePhoto from "../assets/offers/cappuccino-shake.jpg";
import cappuccinoPhoto from "../assets/offers/cappuccino.jpg";
import pizzaPhoto from "../assets/offers/pizza-pepperoni.jpg";
import sushiPhoto from "../assets/offers/sushi-philadelphia.jpg";
import steakPhoto from "../assets/offers/steak.jpg";
import shawarmaPhoto from "../assets/offers/shawarma.jpg";
import tomYumPhoto from "../assets/offers/tom-yum.jpg";
import padThaiPhoto from "../assets/offers/pad-thai.jpg";

type Category = ShowcaseCategory;
type Offer = RibbonOffer;

/** Состояние «заказа в 1 клик» по каждой плитке (ключ — id плитки, общий для оригинала и копии в бесшовной петле). */
type OrderState = { status: "pending" } | { status: "done"; orderId: string } | { status: "error"; message: string };

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

/** Демо-плитки: показываются, только пока нет живых офферов из API (backend недоступен или витрина пуста). Заказать их нельзя. */
const DEMO_OFFERS: Offer[] = [
  // --- Еда: у каждого офера — своё настоящее фото блюда (apps/web/src/assets/offers). ---
  { id: "1", category: "food", shop: "Burger Yard", title: "Даблбургер с беконом и сыром", oldPrice: 450, price: 293, discount: 35, distance: "500 м", pickup: "до 21:10", minutesLeft: 95, image: burgerPhoto },
  { id: "2", category: "food", shop: "Trattoria Uno", title: "Паста Карбонара", oldPrice: 520, price: 286, discount: 45, distance: "1.2 км", pickup: "до 20:45", minutesLeft: 70, image: carbonaraPhoto },
  { id: "3", category: "food", shop: "Green Bowl", title: "Салат Цезарь с курицей-гриль", oldPrice: 390, price: 254, discount: 35, distance: "700 м", pickup: "до 21:15", minutesLeft: 110, image: caesarSaladPhoto },
  { id: "4", category: "food", shop: "Fry Corner", title: "Картофель фри, большая порция", oldPrice: 220, price: 77, discount: 65, distance: "350 м", pickup: "через 35 мин", minutesLeft: 35, image: friesPhoto },
  { id: "5", category: "food", shop: "Poke Point", title: "Поке с лососем и манго", oldPrice: 590, price: 354, discount: 40, distance: "1.5 км", pickup: "до 21:30", minutesLeft: 130, image: pokePhoto },
  { id: "6", category: "food", shop: "Cafe Loft", title: "Капучино + молочный коктейль", oldPrice: 380, price: 190, discount: 50, distance: "300 м", pickup: "до 20:15", minutesLeft: 55, image: cappuccinoShakePhoto },
  { id: "7", category: "food", shop: "Coffee Loop", title: "Капучино на вынос", oldPrice: 250, price: 100, discount: 60, distance: "150 м", pickup: "через 20 мин", minutesLeft: 20, image: cappuccinoPhoto },
  { id: "8", category: "food", shop: "Pizza Loft", title: "Пицца Пепперони, половина", oldPrice: 480, price: 264, discount: 45, distance: "900 м", pickup: "до 22:00", minutesLeft: 160, image: pizzaPhoto },
  { id: "9", category: "food", shop: "Sushi Wave", title: "Сет Филадельфия, 8 шт", oldPrice: 890, price: 400, discount: 55, distance: "1.8 км", pickup: "до 21:00", minutesLeft: 100, image: sushiPhoto },
  { id: "10", category: "food", shop: "Grill House", title: "Стейк из говядины на гриле", oldPrice: 990, price: 594, discount: 40, distance: "2.1 км", pickup: "до 22:30", minutesLeft: 180, image: steakPhoto },
  { id: "11", category: "food", shop: "Shava Point", title: "Шаурма классическая с говядиной", oldPrice: 320, price: 128, discount: 60, distance: "400 м", pickup: "через 30 мин", minutesLeft: 30, image: shawarmaPhoto },
  { id: "12", category: "food", shop: "Thai Wok", title: "Том Ям с креветками", oldPrice: 550, price: 302, discount: 45, distance: "1.3 км", pickup: "до 21:20", minutesLeft: 105, image: tomYumPhoto },
  { id: "13", category: "food", shop: "Thai Wok", title: "Лапша Пад Тай с курицей", oldPrice: 480, price: 144, discount: 70, distance: "1.3 км", pickup: "через 42 мин", minutesLeft: 42, image: padThaiPhoto },
  // --- Остальные категории — без фото (своих снимков под них нет), как и раньше: category-тинт с иконкой. ---
  { id: "14", category: "bakery", shop: "Sonnig Bakery", title: "Круассаны и багеты, набор", oldPrice: 340, price: 150, discount: 55, distance: "650 м", pickup: "до 20:00", minutesLeft: 120 },
  { id: "15", category: "bakery", shop: "Хлеб и Соль", title: "Пироги с ягодами, 2 шт", oldPrice: 420, price: 250, discount: 40, distance: "900 м", pickup: "до 22:00", minutesLeft: 150 },
  { id: "16", category: "flowers", shop: "Полевой цветочный", title: "Букет дня — микс сезонных", oldPrice: 1490, price: 890, discount: 40, distance: "1.4 км", pickup: "до 21:00", minutesLeft: 100 },
  { id: "17", category: "flowers", shop: "GreenHouse Flowers", title: "Моно-букет: пионы", oldPrice: 2200, price: 660, discount: 70, distance: "2 км", pickup: "через 25 мин", minutesLeft: 25 },
  { id: "18", category: "groceries", shop: "Свежий Корнер", title: "Овощи и фрукты, набор дня", oldPrice: 650, price: 260, discount: 60, distance: "300 м", pickup: "до 21:45", minutesLeft: 46 },
  { id: "19", category: "groceries", shop: "Маркет Дня", title: "Молочная линейка, набор", oldPrice: 380, price: 210, discount: 45, distance: "800 м", pickup: "до 20:30", minutesLeft: 80 },
];

/**
 * Живая лента реальных офферов — тянет драгом/скроллом, фильтруется по
 * категории, карточки можно сохранить (heart). Не декорация: состояние
 * фильтра и лайков реально меняет то, что видно на экране.
 */
export function OffersRibbon() {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const live = useShowcaseOffers();
  const source = live ?? DEMO_OFFERS;
  const [orders, setOrders] = useState<Record<string, OrderState>>({});
  const [consentFor, setConsentFor] = useState<Offer | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Лента едет сама, но пользователь может её остановить (WCAG 2.2.2). При prefers-reduced-motion стартует
  // остановленной — раньше она в этом случае просто стояла без объяснений и выглядела сломанной.
  const [playing, setPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  // Пока идёт оплата или открыт диалог, плитка не должна уезжать из-под курсора/пальца.
  const busyRef = useRef(0);
  const headerRef = useReveal<HTMLDivElement>();
  const stripRef = useReveal<HTMLDivElement>();

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startScroll: number; pending: boolean; dragging: boolean }>({
    startX: 0,
    startScroll: 0,
    pending: false,
    dragging: false,
  });

  const visible = useMemo(() => (filter === "all" ? source : source.filter((o) => o.category === filter)), [filter, source]);
  const animatedCount = useAnimatedCount(visible.length);

  // Лента дублируется, чтобы петля была бесшовной: как только автоскролл
  // проходит первую копию целиком, мы отматываем scrollLeft ровно на её
  // ширину назад — визуально это неотличимо от продолжения бегущей строки.
  const loopedOffers = useMemo(() => [...visible, ...visible], [visible]);

  const isHoveredRef = useRef(false);
  // Клавиатурный фокус внутри ленты тоже ставит бегущую строку на паузу: иначе кнопка "в избранное"
  // уезжает из-под фокуса, пока пользователь на неё нажимает (WCAG 2.2.2).
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [filter]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;

    const SPEED = 0.5; // px за кадр (~30px/с при 60fps) — читаемый темп бегущей строки
    // Позицию копим дробной: браузеры округляют scrollLeft до целого, и `scrollLeft += 0.5` на части
    // платформ (Safari, экраны с DPR 1) молча терялось — лента стояла на месте.
    let pos = el.scrollLeft;
    let raf = 0;

    const tick = () => {
      const paused = isHoveredRef.current || isFocusedRef.current || dragState.current.dragging || busyRef.current > 0;
      if (paused) {
        pos = el.scrollLeft; // пока стоим, пользователь мог сдвинуть ленту сам — продолжаем с того места
      } else {
        const half = el.scrollWidth / 2;
        // Если лента сдвинута извне (драг, колесо), подхватываем её реальное положение.
        if (Math.abs(el.scrollLeft - pos) > 2) pos = el.scrollLeft;
        pos += SPEED;
        if (half > 0 && pos >= half) pos -= half;
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loopedOffers, playing]);

  const runOrder = async (offer: Offer) => {
    if (!offer.offerId) return;
    const key = offer.id;
    setOrders((prev) => ({ ...prev, [key]: { status: "pending" } }));
    busyRef.current += 1;
    try {
      const orderId = await placeOrder(offer.offerId, 1);
      setOrders((prev) => ({ ...prev, [key]: { status: "done", orderId } }));
      setAnnouncement(`Заказ оформлен: ${offer.title}. Код самовывоза — в разделе «Мои заказы».`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось оформить заказ";
      setOrders((prev) => ({ ...prev, [key]: { status: "error", message } }));
      setAnnouncement(`Не удалось оформить заказ: ${message}`);
    } finally {
      busyRef.current -= 1;
    }
  };

  const handleOneClick = (offer: Offer) => {
    const state = orders[offer.id];
    // Защита от двойного клика/повторного заказа: пока заказ в полёте или уже оформлен — нажатие игнорируется.
    if (state?.status === "pending" || state?.status === "done") return;
    if (!hasOneClickConsent()) {
      busyRef.current += 1;
      setConsentFor(offer);
      return;
    }
    void runOrder(offer);
  };

  const closeConsent = () => {
    busyRef.current -= 1;
    setConsentFor(null);
  };

  const toggleLike = (id: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Пауза по наведению — только для мыши. На тач-устройствах pointerenter срабатывает при
  // касании, а парный pointerleave после отпускания пальца не гарантирован — лента иначе
  // замирает навсегда после первого тапа. Тач и так ставит на паузу через dragState (ниже).
  const handlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") isHoveredRef.current = true;
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") isHoveredRef.current = false;
    endDrag(event);
  };

  // Драг начинается только после сдвига на DRAG_THRESHOLD px. Раньше setPointerCapture вызывался сразу на
  // pointerdown: захват уводил pointerup (а с ним и click) на контейнер, и кнопка "в избранное" на
  // карточке никогда не срабатывала.
  const DRAG_THRESHOLD = 5;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = { startX: event.clientX, startScroll: el.scrollLeft, pending: true, dragging: false };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const state = dragState.current;
    if (!el || !state.pending) return;
    const delta = event.clientX - state.startX;
    if (!state.dragging) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return;
      state.dragging = true;
      el.setPointerCapture(event.pointerId);
    }
    el.scrollLeft = state.startScroll - delta;
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    state.pending = false;
    if (!state.dragging) return;
    state.dragging = false;
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

          <div className="ribbon-controls">
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
          <button
            type="button"
            className="ribbon-play"
            aria-pressed={!playing}
            aria-label={playing ? "Остановить движение ленты" : "Запустить движение ленты"}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
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
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onBlur={() => {
              isFocusedRef.current = false;
            }}
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
                  signedIn={!!user}
                  orderState={orders[offer.id]}
                  onOneClick={() => handleOneClick(offer)}
                />
              );
            })}
          </div>
          <div className="ribbon-fade ribbon-fade-left" aria-hidden="true" />
          <div className="ribbon-fade ribbon-fade-right" aria-hidden="true" />
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>

      {consentFor && consentFor.priceMinor !== undefined ? (
        <OneClickDialog
          title={consentFor.title}
          shop={consentFor.shop}
          priceMinor={consentFor.priceMinor}
          onCancel={closeConsent}
          onConfirm={(method) => {
            const offer = consentFor;
            writePaymentMethod(method);
            grantOneClickConsent();
            closeConsent();
            void runOrder(offer);
          }}
        />
      ) : null}
    </section>
  );
}

function OfferTile({
  offer,
  index,
  liked,
  onToggleLike,
  duplicate,
  signedIn,
  orderState,
  onOneClick,
}: {
  offer: Offer;
  index: number;
  liked: boolean;
  onToggleLike: () => void;
  duplicate?: boolean;
  signedIn: boolean;
  orderState?: OrderState;
  onOneClick: () => void;
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
        {offer.image ? (
          <img className="offer-tile-photo-img" src={offer.image} alt={offer.title} loading="lazy" decoding="async" />
        ) : (
          <span className="offer-tile-photo-plate" aria-hidden="true">
            <Icon size={32} strokeWidth={1.5} color={hot ? "var(--color-danger)" : "var(--color-primary)"} aria-hidden="true" />
          </span>
        )}
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
      {offer.offerId ? (
        <div className="offer-tile-action">
          {orderState?.status === "done" ? (
            <Link to={`/orders/${orderState.orderId}`} tabIndex={duplicate ? -1 : undefined} className="offer-tile-oneclick is-done">
              <Check size={15} strokeWidth={2.8} aria-hidden="true" /> Заказано · открыть билет
            </Link>
          ) : signedIn ? (
            <button
              type="button"
              tabIndex={duplicate ? -1 : undefined}
              className="offer-tile-oneclick"
              disabled={orderState?.status === "pending" || (offer.quantityLeft ?? 1) <= 0}
              onClick={onOneClick}
              aria-label={`Заказать в 1 клик: ${offer.title}, ${offer.price} ₽`}
            >
              {orderState?.status === "pending" ? (
                <>
                  <span className="spinner spinner-sm" aria-hidden="true" /> Оплата…
                </>
              ) : (
                <>
                  <Zap size={15} strokeWidth={2.4} aria-hidden="true" /> Заказать за {formatRub((offer.priceMinor ?? offer.price * 100))}
                </>
              )}
            </button>
          ) : (
            <Link
              to="/login"
              state={{ from: { pathname: "/" } }}
              tabIndex={duplicate ? -1 : undefined}
              className="offer-tile-oneclick is-guest"
            >
              <Zap size={15} strokeWidth={2.4} aria-hidden="true" /> Войти и заказать
            </Link>
          )}
          {orderState?.status === "error" && !duplicate ? (
            <p className="offer-tile-error" role="alert">
              {orderState.message}
            </p>
          ) : null}
        </div>
      ) : null}
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
