import { getTimeLeft, getUrgencyRatio, heatColor, type NearbyOffer } from "@apetite/shared";

export interface PinSpec {
  size: number;
  color: string;
  fontSize: number;
  text: string;
}

/**
 * Вид пина — единый для обеих карт (Leaflet и Яндекс). Размер — от величины скидки, цвет — от оставшегося
 * времени (шкала «жара» как в приложении): два независимых сигнала вместо одного смешанного.
 */
export function pinSpec(offer: Pick<NearbyOffer, "discountPercent" | "pickupEnd">, selected: boolean): PinSpec {
  const hot = offer.discountPercent >= 60;
  return {
    size: selected ? 52 : hot ? 44 : 38,
    color: heatColor(getUrgencyRatio(getTimeLeft(offer.pickupEnd)), "light"),
    fontSize: selected ? 12 : hot ? 11 : 10,
    text: `−${offer.discountPercent}%`,
  };
}
