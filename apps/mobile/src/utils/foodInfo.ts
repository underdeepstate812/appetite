import { hasFoodInfo, requiresFoodInfo, type Offer } from "@apetite/shared";

type FoodOffer = Pick<Offer, "category" | "ingredients" | "allergens" | "allergensDeclared" | "bestBefore">;

/** «5 окт., 18:00» — срок годности в одной понятной строке. */
export function formatBestBefore(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Что показать покупателю до оплаты:
 *  - none — для этой категории (цветы) состав не нужен;
 *  - missing — состав обязателен, но заведение его не указало (старое предложение): честно говорим «уточните»;
 *  - complete — всё указано.
 */
export function foodInfoStatus(offer: FoodOffer): "none" | "missing" | "complete" {
  if (!requiresFoodInfo(offer.category)) return "none";
  return hasFoodInfo(offer) ? "complete" : "missing";
}
