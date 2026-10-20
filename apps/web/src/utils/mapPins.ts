import { getOfferUrgencyRatio, heatColor, type NearbyOffer } from "@apetite/shared";
import { resolveAssetUrl } from "../api/client";
import { isHotOffer } from "./offers";

export type PinKind = "photo" | "drop";

export interface PinSpec {
  /** «photo» — круглое фото блюда (горячие предложения); «drop» — капля со скидкой (остальные и горячие без фото). */
  kind: PinKind;
  size: number;
  color: string;
  fontSize: number;
  text: string;
  /** «Горячее предложение дня» — пин крупнее и с пульсирующим ореолом. */
  featured: boolean;
  /** Абсолютная ссылка на фото; только у kind === "photo". */
  photoUrl: string | null;
}

type PinOffer = Pick<NearbyOffer, "discountPercent" | "pickupEnd"> & { featured?: boolean; imageUrl?: string | null };

/**
 * Вид пина — единый для обеих карт (Leaflet и Яндекс). Цвет — от оставшегося времени (шкала «жара» как в
 * приложении). Горящее предложение с фото рисуется кружком с самим блюдом: на карте города из десятков точек
 * «что именно горит» читается без клика. Остальные — каплей, размер которой растёт со скидкой.
 */
export function pinSpec(offer: PinOffer, selected: boolean, now: number = Date.now(), scale: number = 1): PinSpec {
  const featured = !!offer.featured;
  const color = heatColor(getOfferUrgencyRatio(offer, now), "light");
  const text = `−${offer.discountPercent}%`;
  const photoUrl = isHotOffer(offer, now) ? resolveAssetUrl(offer.imageUrl) : null;
  // Выбранная метка масштабом не сжимается: её надо хорошо видеть при любом зуме.
  const k = selected ? 1 : scale;

  if (photoUrl) {
    return { kind: "photo", featured, color, text, photoUrl, size: Math.round((selected ? 54 : featured ? 48 : 42) * k), fontSize: 10 };
  }
  const deep = offer.discountPercent >= 60;
  return {
    kind: "drop",
    featured,
    color,
    text,
    photoUrl: null,
    size: Math.round((selected ? 52 : featured ? 46 : deep ? 38 : 32) * k),
    fontSize: Math.max(8, Math.round((selected ? 12 : featured ? 12 : deep ? 10 : 9) * Math.sqrt(k))),
  };
}

/**
 * Масштаб меток от зума карты: на общем виде города (десятки точек на пятачке) метки мельче, чтобы не слипаться,
 * при приближении — полного размера. Ступени, а не плавная кривая: метки перерисовываются только при смене ступени.
 */
export function pinScaleForZoom(zoom: number): number {
  if (zoom < 11.5) return 0.75;
  if (zoom < 12.5) return 0.82;
  if (zoom < 13.5) return 0.9;
  return 1;
}

/** Порядок «слоёв» меток: выбранная выше всех, затем предложение дня, затем горящие с фото (они не должны прятаться под каплями), затем по скидке. */
export function pinZIndex(offer: PinOffer, selected: boolean, now: number = Date.now()): number {
  if (selected) return 1000;
  if (offer.featured) return 900;
  return (pinSpec(offer, false, now).kind === "photo" ? 500 : 0) + offer.discountPercent;
}
