import type { NearbyOffer } from "@apetite/shared";
import { getTimeLeft, getUrgencyRatio } from "./time";

/**
 * Порог "горящего" оффера — тот же urgency ≥ 0.55 (≈ последние 80 минут
 * 3-часового окна), что и у чипа "Горящих скидок" над картой: витрина и чип
 * не должны расходиться в том, что считать горящим.
 */
export const HOT_URGENCY_RATIO = 0.55;

type Sortable = Pick<NearbyOffer, "pickupEnd" | "discountPercent" | "distanceKm">;

export function isHotOffer(offer: Pick<NearbyOffer, "pickupEnd">, now: number = Date.now()): boolean {
  const timeLeft = getTimeLeft(offer.pickupEnd, now);
  return !timeLeft.isPast && getUrgencyRatio(timeLeft) >= HOT_URGENCY_RATIO;
}

/**
 * Порядок витрины: сначала горящие, внутри каждой группы — по убыванию скидки,
 * при равной скидке раньше тот, у кого раньше конец самовывоза, затем ближайший.
 * Предложения, у которых окно самовывоза уже закрылось (архивация на бэкенде идёт
 * с задержкой), уходят в самый конец — они не должны вытеснять живые.
 * Возвращает новый массив, исходный не мутирует.
 */
export function sortHotFirst<T extends Sortable>(offers: T[], now: number = Date.now()): T[] {
  return offers
    .map((offer) => ({ offer, hot: isHotOffer(offer, now), closed: getTimeLeft(offer.pickupEnd, now).isPast }))
    .sort((a, b) => {
      if (a.closed !== b.closed) return a.closed ? 1 : -1;
      if (a.hot !== b.hot) return a.hot ? -1 : 1;
      if (a.offer.discountPercent !== b.offer.discountPercent) return b.offer.discountPercent - a.offer.discountPercent;
      const endDiff = new Date(a.offer.pickupEnd).getTime() - new Date(b.offer.pickupEnd).getTime();
      if (endDiff !== 0) return endDiff;
      return a.offer.distanceKm - b.offer.distanceKm;
    })
    .map(({ offer }) => offer);
}
