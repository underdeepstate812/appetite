import { getOfferUrgencyRatio, heatColor, type NearbyOffer } from "@apetite/shared";

export interface PinSpec {
  size: number;
  color: string;
  fontSize: number;
  text: string;
  /** «Горячее предложение дня» — пин крупнее и с пульсирующим ореолом. */
  featured: boolean;
}

/**
 * Вид пина — единый для обеих карт (Leaflet и Яндекс). Размер — от величины скидки, цвет — от оставшегося
 * времени (шкала «жара» как в приложении): два независимых сигнала вместо одного смешанного.
 */
export function pinSpec(offer: Pick<NearbyOffer, "discountPercent" | "pickupEnd"> & { featured?: boolean }, selected: boolean): PinSpec {
  const hot = offer.discountPercent >= 60;
  const featured = !!offer.featured;
  return {
    featured,
    size: selected ? 56 : featured ? 54 : hot ? 44 : 38,
    color: heatColor(getOfferUrgencyRatio(offer), "light"),
    fontSize: selected ? 13 : featured ? 13 : hot ? 11 : 10,
    text: `−${offer.discountPercent}%`,
  };
}
