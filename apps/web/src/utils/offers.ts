import { getTimeLeft, getUrgencyRatio, type NearbyOffer } from "@apetite/shared";

/** Тот же порог «горящего» оффера (urgency ≥ 0.55, ≈ последние 80 минут окна), что и в мобильном приложении. */
export const HOT_URGENCY_RATIO = 0.55;

type Sortable = Pick<NearbyOffer, "pickupEnd" | "discountPercent" | "distanceKm"> & { featured?: boolean };

/** «Горячее предложение дня» (featured) горит всегда, пока окно открыто, — по времени оно «спокойное» (живёт сутки). */
export function isHotOffer(offer: Pick<NearbyOffer, "pickupEnd"> & { featured?: boolean }, now: number = Date.now()): boolean {
  const timeLeft = getTimeLeft(offer.pickupEnd, now);
  if (timeLeft.isPast) return false;
  return !!offer.featured || getUrgencyRatio(timeLeft) >= HOT_URGENCY_RATIO;
}

/**
 * Порядок витрины как в приложении: сначала «предложение дня» (featured), затем горящие, внутри группы — по убыванию скидки,
 * при равной скидке раньше тот, у кого раньше конец самовывоза, затем ближайший.
 * Закрывшиеся окна — в самый конец. Возвращает новый массив.
 */
export function sortHotFirst<T extends Sortable>(offers: T[], now: number = Date.now()): T[] {
  return offers
    .map((offer) => ({ offer, hot: isHotOffer(offer, now), closed: getTimeLeft(offer.pickupEnd, now).isPast }))
    .sort((a, b) => {
      if (a.closed !== b.closed) return a.closed ? 1 : -1;
      if (!!a.offer.featured !== !!b.offer.featured) return a.offer.featured ? -1 : 1;
      if (a.hot !== b.hot) return a.hot ? -1 : 1;
      if (a.offer.discountPercent !== b.offer.discountPercent) return b.offer.discountPercent - a.offer.discountPercent;
      const endDiff = new Date(a.offer.pickupEnd).getTime() - new Date(b.offer.pickupEnd).getTime();
      if (endDiff !== 0) return endDiff;
      return a.offer.distanceKm - b.offer.distanceKm;
    })
    .map(({ offer }) => offer);
}
