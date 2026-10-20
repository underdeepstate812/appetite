import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, CircleCheck, CircleX, Copy, Check, Hourglass, MapPin, Navigation } from "lucide-react";
import { OrderStatus, type Business, type Offer, type Order } from "@apetite/shared";
import { ApiError } from "../api/client";
import { businessesApi } from "../api/businesses";
import { offersApi } from "../api/offers";
import { ordersApi } from "../api/orders";
import { OrderTimeline } from "../components/OrderTimeline";
import { ReceiptPanel } from "../components/ReceiptPanel";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatClock, formatPickupEnd, formatRub } from "../utils/format";

/** Пока заказ ждёт самовывоза, статус меняется на стороне заведения (подтвердило/выдало) — подтягиваем его сами. */
const POLL_MS = 10_000;

export function OrderTicketPage() {
  const { orderId = "" } = useParams();
  const location = useLocation();
  const justPaid = (location.state as { justPaid?: boolean } | null)?.justPaid === true;
  usePageTitle(justPaid ? "Заказ оплачен — Appetite" : "Заказ — Appetite");

  const [order, setOrder] = useState<Order | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const staticLoaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await ordersApi.get(orderId);
      setOrder(data);
      setError(null);
      // Оффер, заведение и QR не меняются между опросами — тянем один раз, дальше опрашиваем только заказ.
      if (!staticLoaded.current) {
        staticLoaded.current = true;
        const [offerData, qrData] = await Promise.all([
          offersApi.get(data.offerId),
          data.status === OrderStatus.CONFIRMED ? ordersApi.getQrCode(orderId) : Promise.resolve(null),
        ]);
        setOffer(offerData);
        setQr(qrData?.qrCodeDataUrl ?? null);
        businessesApi
          .get(data.businessId)
          .then(setBusiness)
          .catch(() => {});
      }
    } catch (loadError) {
      staticLoaded.current = false;
      setError(loadError instanceof ApiError && loadError.statusCode === 404 ? "Заказ не найден." : loadError instanceof Error ? loadError.message : "Не удалось загрузить заказ");
    }
  }, [orderId]);

  useEffect(() => {
    staticLoaded.current = false;
    setOrder(null);
    void load();
  }, [load]);

  const active = order?.status === OrderStatus.CONFIRMED;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [active, load]);

  const copyCode = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.pickupCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // нет доступа к буферу (http, запрет) — код и так показан крупно
    }
  };

  if (error && !order) {
    return (
      <div className="app-page ticket-page">
        <div className="card app-state" role="alert">
          <h1>Не получилось открыть заказ</h1>
          <p>{error}</p>
          <div className="app-state-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void load()}>
              Повторить
            </button>
            <Link to="/orders" className="btn btn-primary">
              Мои заказы
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!order || !offer) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" /> Загрузка…
      </div>
    );
  }

  const windowOpen = Date.now() >= new Date(offer.pickupStart).getTime();
  const mapsLink = business
    ? `https://www.openstreetmap.org/?mlat=${business.lat}&mlon=${business.lng}#map=17/${business.lat}/${business.lng}`
    : null;

  return (
    <div className="app-page ticket-page">
      <Link to="/orders" className="app-back">
        <ArrowLeft size={16} aria-hidden="true" /> Мои заказы
      </Link>

      <header className="ticket-head">
        {active ? (
          <span className={`ticket-badge${justPaid ? " is-pop" : ""}`}>
            <CircleCheck size={16} aria-hidden="true" /> Оплата прошла
          </span>
        ) : null}
        <h1 className="app-title">{active ? (justPaid ? "Заказ оплачен" : offer.title) : offer.title}</h1>
        <p className="ticket-sub">
          {formatRub(order.totalPrice)} · {offer.title}
          {business ? ` · ${business.name}` : ""}
        </p>
      </header>

      {active ? (
        <>
          <OrderTimeline pickupStart={offer.pickupStart} pickupEnd={offer.pickupEnd} acceptedAt={order.acceptedAt} />

          <section className={`card pickup-ticket${justPaid ? " is-entering" : ""}${windowOpen ? " is-ready" : ""}`} aria-label="Билет на самовывоз">
            <p className="pickup-ticket-lead">Покажи код или QR на кассе</p>
            {qr ? (
              <div className="pickup-qr">
                <img src={qr} alt={`QR-код заказа, код самовывоза ${order.pickupCode}`} width={200} height={200} />
              </div>
            ) : null}
            <p className="pickup-code-label">Код самовывоза</p>
            <div className="pickup-code" aria-label={`Код ${order.pickupCode.split("").join(" ")}`}>
              {order.pickupCode.split("").map((digit, index) => (
                <span key={index} style={{ animationDelay: `${0.5 + index * 0.06}s` }}>
                  {digit}
                </span>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm pickup-copy" onClick={() => void copyCode()}>
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? "Скопировано" : "Скопировать код"}
            </button>
            <p className="pickup-footnote">
              Забрать {formatPickupEnd(offer.pickupEnd)}
              {windowOpen ? "" : ` · окно откроется в ${formatClock(offer.pickupStart)}`}
            </p>
          </section>

          {business ? (
            <section className="card ticket-place" aria-label="Где забирать">
              <MapPin size={18} aria-hidden="true" />
              <div>
                <strong>{business.name}</strong>
                <span>{business.address}</span>
              </div>
              {mapsLink ? (
                <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                  <Navigation size={14} aria-hidden="true" /> Маршрут
                </a>
              ) : null}
            </section>
          ) : null}
          <p className="ticket-rule">После оплаты заказ отменить нельзя — если что-то пошло не так, напишите в поддержку.</p>
        </>
      ) : (
        <>
          <StatusNote status={order.status} />
          <ReceiptPanel order={order} onUpdated={setOrder} />
        </>
      )}

      <div className="ticket-actions">
        <Link to="/orders" className="btn btn-primary">
          К моим заказам
        </Link>
        <Link to="/home" className="btn btn-secondary">
          Ещё предложения
        </Link>
      </div>
    </div>
  );
}

function StatusNote({ status }: { status: OrderStatus }) {
  const map = {
    [OrderStatus.COMPLETED]: { Icon: CircleCheck, text: "Заведение отметило, что заказ выдан." },
    [OrderStatus.CANCELLED]: { Icon: CircleX, text: "Заказ отменён поддержкой. Деньги будут возвращены." },
    [OrderStatus.EXPIRED]: { Icon: Hourglass, text: "Окно самовывоза закончилось — заказ просрочен." },
    [OrderStatus.CONFIRMED]: { Icon: CircleCheck, text: "" },
  }[status];
  return (
    <div className="card ticket-note">
      <map.Icon size={22} aria-hidden="true" />
      <p>{map.text}</p>
    </div>
  );
}
