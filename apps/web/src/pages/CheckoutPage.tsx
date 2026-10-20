import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Lock, MapPin, ShieldCheck } from "lucide-react";
import { getTimeLeft, type Business, type Offer } from "@apetite/shared";
import { ApiError } from "../api/client";
import { businessesApi } from "../api/businesses";
import { offersApi } from "../api/offers";
import { OfferPhoto } from "../components/OfferPhoto";
import { FoodInfo } from "../components/FoodInfo";
import { PaymentMethodSelector, type PaymentMethod } from "../components/PaymentMethodSelector";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatPickupWindow, formatRub } from "../utils/format";
import { readPaymentMethod, writePaymentMethod } from "../utils/paymentPrefs";
import { placeOrder } from "../utils/placeOrder";

/** Количество фиксировано в 1 (как «сюрприз-пакет» в мобильном приложении) — без степпера, проще для беты. */
const QUANTITY = 1;
/** Mock-оплата отвечает мгновенно — без паузы анимация «готовим заказ» мигнёт и её не увидят. Это не эмуляция задержки платежа, а время доиграть один цикл. */
const MIN_COOKING_MS = 1100;
/** Сколько держим экран «оплата подтверждена» до перехода к билету. */
const CELEBRATION_MS = 1500;

type Phase = "form" | "cooking" | "paid";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function CheckoutPage() {
  usePageTitle("Оформление заказа — Appetite");
  const { offerId = "" } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>(readPaymentMethod);
  const [phase, setPhase] = useState<Phase>("form");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);

  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setOffer(null);
    offersApi
      .get(offerId)
      .then(async (data) => {
        if (cancelled) return;
        setOffer(data);
        // Название заведения — приятная деталь, но не повод ломать оформление, если запрос не прошёл.
        businessesApi
          .get(data.businessId)
          .then((b) => !cancelled && setBusiness(b))
          .catch(() => {});
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof ApiError && error.statusCode === 404 ? "Предложение не найдено или уже снято с витрины." : error instanceof Error ? error.message : "Не удалось загрузить предложение");
      });
    return () => {
      cancelled = true;
    };
  }, [offerId, reloadKey]);

  // Пока платёж в полёте, закрытие вкладки может потерять результат — браузер спросит подтверждение.
  useEffect(() => {
    if (phase === "form") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const chooseMethod = (next: PaymentMethod) => {
    setMethod(next);
    writePaymentMethod(next);
  };

  const goToTicket = useCallback(
    (orderId: string) => {
      setPhase("paid");
      leaveTimer.current = setTimeout(() => {
        // replace — чтобы «назад» с билета не возвращало на уже оплаченную форму.
        navigate(`/orders/${orderId}`, { replace: true, state: { justPaid: true } });
      }, CELEBRATION_MS);
    },
    [navigate]
  );

  const handlePay = async () => {
    if (!offer || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    setPhase("cooking");
    try {
      const [orderId] = await Promise.all([placeOrder(offer.id, QUANTITY), wait(MIN_COOKING_MS)]);
      goToTicket(orderId);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось оформить заказ");
      setPhase("form");
      submittingRef.current = false;
    }
  };

  if (loadError) {
    return (
      <div className="app-page checkout-page">
        <div className="card app-state" role="alert">
          <h1>Не получилось открыть оформление</h1>
          <p>{loadError}</p>
          <div className="app-state-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Повторить
            </button>
            <Link to="/home" className="btn btn-primary">
              К витрине
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" /> Загрузка…
      </div>
    );
  }

  if (phase === "cooking") {
    return (
      <div className="app-page checkout-page">
        <div className="pay-progress" role="status" aria-live="polite">
          <div className="cooking" aria-hidden="true">
            <span className="cooking-pan" />
            <span className="cooking-steam" />
            <span className="cooking-steam" />
            <span className="cooking-steam" />
          </div>
          <h1>Готовим твой заказ</h1>
          <p>Оплата обрабатывается — это займёт пару секунд. Не закрывай страницу.</p>
        </div>
      </div>
    );
  }

  if (phase === "paid") {
    return (
      <div className="app-page checkout-page">
        <div className="pay-progress" role="status" aria-live="polite">
          <div className="celebration" aria-hidden="true">
            <span className="celebration-ring" />
            <svg viewBox="0 0 52 52" className="celebration-check">
              <path d="M14 27 L23 36 L39 17" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {Array.from({ length: 10 }, (_, index) => (
              <span key={index} className="celebration-spark" style={{ ["--a" as string]: `${index * 36}deg` }} />
            ))}
          </div>
          <h1>Оплата подтверждена</h1>
          <p>Передаём заказ заведению…</p>
        </div>
      </div>
    );
  }

  const timeLeft = getTimeLeft(offer.pickupEnd);
  const soldOut = offer.quantityLeft <= 0;
  const unavailable = soldOut || timeLeft.isPast || offer.status !== "ACTIVE";
  const total = offer.discountedPrice * QUANTITY;
  const saved = (offer.originalPrice - offer.discountedPrice) * QUANTITY;

  return (
    <div className="app-page checkout-page">
      <Link to="/home" className="app-back">
        <ArrowLeft size={16} aria-hidden="true" /> К витрине
      </Link>
      <h1 className="app-title">Оформление заказа</h1>

      <div className="checkout-grid">
        <section className="card checkout-summary" aria-label="Сводка заказа">
          <div className="checkout-offer">
            <OfferPhoto offer={offer} className="checkout-offer-photo" />
            <div>
              <p className="checkout-offer-shop">{business?.name ?? "Заведение"}</p>
              <h2>{offer.title}</h2>
              {business ? (
                <p className="checkout-offer-meta">
                  <MapPin size={13} aria-hidden="true" /> {business.address}
                </p>
              ) : null}
              <p className="checkout-offer-meta">
                <Clock size={13} aria-hidden="true" /> Самовывоз {formatPickupWindow(offer.pickupStart, offer.pickupEnd)}
              </p>
            </div>
          </div>

          <FoodInfo offer={offer} />

          <dl className="checkout-lines">
            <div>
              <dt>Количество</dt>
              <dd>{QUANTITY}</dd>
            </div>
            <div>
              <dt>Цена без скидки</dt>
              <dd className="is-muted">
                <s>{formatRub(offer.originalPrice * QUANTITY)}</s>
              </dd>
            </div>
            <div>
              <dt>Скидка {offer.discountPercent}%</dt>
              <dd className="is-save">−{formatRub(saved)}</dd>
            </div>
            <div className="checkout-total">
              <dt>Итого</dt>
              <dd>{formatRub(total)}</dd>
            </div>
          </dl>
          <p className="checkout-note">Комиссия платформы уже включена в цену — доплат на кассе нет.</p>
        </section>

        <section className="card checkout-pay" aria-label="Оплата">
          <h2>Способ оплаты</h2>
          <PaymentMethodSelector value={method} onChange={chooseMethod} />

          {unavailable ? (
            <p className="form-error" role="alert">
              {soldOut ? "Это предложение уже раскупили." : "Окно самовывоза закрыто или предложение снято."}
            </p>
          ) : null}
          {submitError ? (
            <p className="form-error" role="alert">
              {submitError}
            </p>
          ) : null}

          <button type="button" className="btn btn-primary btn-block checkout-submit" disabled={unavailable} onClick={() => void handlePay()}>
            <Lock size={16} aria-hidden="true" /> Оплатить {formatRub(total)}
          </button>
          <p className="checkout-fineprint">
            <ShieldCheck size={14} aria-hidden="true" />
            Бета: оплата работает в тестовом режиме — деньги не списываются. После оплаты заказ отменить нельзя.
          </p>
        </section>
      </div>
    </div>
  );
}
