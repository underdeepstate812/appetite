import { useCallback, useEffect, useState } from "react";
import type { Order } from "@apetite/shared";
import { ordersApi } from "../api/orders";
import { offersApi } from "../api/offers";
import { businessesApi } from "../api/businesses";
import { isNetworkError, isServerUnavailable } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { loadTicket, saveTicket, type TicketOffer, type TicketSnapshot, type TicketVenue } from "../utils/ticketCache";
import type { BusinessState } from "./useBusiness";

interface TicketState {
  status: "loading" | "ready" | "error";
  order: Order | null;
  offer: TicketOffer | null;
  qrCodeDataUrl: string | null;
  venue: TicketVenue | null;
  /** Показана сохранённая копия, потому что до сервера не достучаться. */
  offline: boolean;
  /** Когда эта копия сделана (ISO) — имеет смысл только при offline. */
  savedAt: string | null;
  error: string | null;
  /** Ошибка — именно «нет связи» (а не ответ сервера): экран покажет офлайн-состояние с повтором. */
  networkError: boolean;
}

const INITIAL: TicketState = { status: "loading", order: null, offer: null, qrCodeDataUrl: null, venue: null, offline: false, savedAt: null, error: null, networkError: false };

const fromSnapshot = (snapshot: TicketSnapshot): TicketState => ({
  status: "ready",
  order: snapshot.order,
  offer: snapshot.offer,
  qrCodeDataUrl: snapshot.qrCodeDataUrl,
  venue: snapshot.venue,
  offline: false,
  savedAt: snapshot.savedAt,
  error: null,
  networkError: false,
});

const pickOffer = (o: TicketOffer): TicketOffer => ({ id: o.id, title: o.title, pickupStart: o.pickupStart, pickupEnd: o.pickupEnd });
const pickVenue = (v: TicketVenue): TicketVenue => ({ id: v.id, name: v.name, address: v.address, lat: v.lat, lng: v.lng });

/**
 * Билет заказа: «сначала сохранённое, потом свежее». Копия с прошлого раза открывается мгновенно и работает без сети;
 * параллельно идёт запрос, и по его итогу экран обновляется и копия перезаписывается. Если сервер недоступен —
 * остаёмся на копии и честно говорим об этом (`offline`), а не показываем ошибку человеку, которому нужно просто показать код.
 */
export function useTicket(orderId: string) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [state, setState] = useState<TicketState>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let networkSettled = false;
    // При повторной загрузке того же заказа содержимое не сбрасываем: экран не должен мигать.
    setState((current) => (current.order?.id === orderId ? { ...current, error: null } : INITIAL));

    const cached = loadTicket(orderId, userId);
    void cached.then((snapshot) => {
      if (!cancelled && !networkSettled && snapshot) setState(fromSnapshot(snapshot));
    });

    (async () => {
      try {
        const order = await ordersApi.get(orderId);
        const previous = await cached;
        const needsQr = order.status === "CONFIRMED";
        const [qr, offer, business] = await Promise.allSettled([
          needsQr ? ordersApi.getQrCode(orderId) : Promise.resolve(null),
          offersApi.get(order.offerId),
          businessesApi.get(order.businessId),
        ]);

        const qrCodeDataUrl = qr.status === "fulfilled" && qr.value ? qr.value.qrCodeDataUrl : (previous?.qrCodeDataUrl ?? null);
        const offerData = offer.status === "fulfilled" ? pickOffer(offer.value) : (previous?.offer ?? null);
        const venue = business.status === "fulfilled" ? pickVenue(business.value) : (previous?.venue ?? null);
        // Билет без QR или без окна выдачи — не билет: тут, как и раньше, показываем ошибку с повтором.
        if (needsQr && (!qrCodeDataUrl || !offerData)) {
          throw qr.status === "rejected" ? qr.reason : offer.status === "rejected" ? offer.reason : new Error("incomplete ticket");
        }

        networkSettled = true;
        if (cancelled) return;
        setState({ status: "ready", order, offer: offerData, qrCodeDataUrl, venue, offline: false, savedAt: null, error: null, networkError: false });
        if (userId) void saveTicket({ v: 1, userId, savedAt: new Date().toISOString(), order, qrCodeDataUrl, offer: offerData, venue });
      } catch (error) {
        networkSettled = true;
        const snapshot = await cached;
        if (cancelled) return;
        if (snapshot && isServerUnavailable(error)) setState({ ...fromSnapshot(snapshot), offline: true });
        else setState({ ...INITIAL, status: "error", error: error instanceof Error ? error.message : "error", networkError: isNetworkError(error) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, userId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  /** Сервер вернул обновлённый заказ (например, покупатель подтвердил получение): подставляем сразу и обновляем офлайн-копию. */
  const applyOrder = useCallback(
    (order: Order) => {
      setState((current) => (current.order?.id === order.id ? { ...current, order } : current));
      if (userId) {
        void saveTicket({ v: 1, userId, savedAt: new Date().toISOString(), order, qrCodeDataUrl: null, offer: null, venue: null });
      }
    },
    [userId]
  );
  const venueState: BusinessState = state.venue
    ? { status: "ready", business: state.venue }
    : state.status === "loading"
      ? { status: "loading" }
      : { status: "failed" };

  return { ...state, venueState, reload, applyOrder };
}
