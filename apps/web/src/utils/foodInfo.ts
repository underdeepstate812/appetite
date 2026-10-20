import { ALLERGEN_LABELS_RU, hasFoodInfo, isOfferAllergen, requiresFoodInfo, type Offer } from "@apetite/shared";

export type FoodOffer = Pick<Offer, "category" | "ingredients" | "allergens" | "allergensDeclared" | "bestBefore">;

/**
 * Что показать покупателю до оплаты: none — состав для категории не нужен (цветы); missing — обязателен, но заведение
 * его не указало (старое предложение) — честно просим уточнить; complete — всё указано.
 */
export function foodInfoStatus(offer: FoodOffer): "none" | "missing" | "complete" {
  if (!requiresFoodInfo(offer.category)) return "none";
  return hasFoodInfo(offer) ? "complete" : "missing";
}

export function allergenNames(allergens: string[] | undefined): string[] {
  return (allergens ?? []).map((code) => (isOfferAllergen(code) ? ALLERGEN_LABELS_RU[code] : code));
}

/** «5 окт., 22:00» */
export function formatBestBefore(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
