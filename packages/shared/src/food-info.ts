import { OfferCategory } from "./enums";

/**
 * 14 основных аллергенов, о которых производитель обязан сообщать (список как в маркировке пищевой продукции ЕС/ЕАЭС).
 * Храним коды, подписи — на стороне клиента (web/админка — ниже, мобильное приложение — в своих локалях).
 */
export const OFFER_ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;

export type OfferAllergen = (typeof OFFER_ALLERGENS)[number];

export const ALLERGEN_LABELS_RU: Record<OfferAllergen, string> = {
  gluten: "Глютен (злаки)",
  crustaceans: "Ракообразные",
  eggs: "Яйца",
  fish: "Рыба",
  peanuts: "Арахис",
  soy: "Соя",
  milk: "Молоко и лактоза",
  nuts: "Орехи",
  celery: "Сельдерей",
  mustard: "Горчица",
  sesame: "Кунжут",
  sulphites: "Сульфиты",
  lupin: "Люпин",
  molluscs: "Моллюски",
};

export function isOfferAllergen(value: string): value is OfferAllergen {
  return (OFFER_ALLERGENS as readonly string[]).includes(value);
}

/** Для еды, выпечки и продуктов состав, аллергены и срок годности обязательны; для цветов — нет. */
export function requiresFoodInfo(category: OfferCategory): boolean {
  return category !== OfferCategory.FLOWERS;
}

export const INGREDIENTS_MIN_LENGTH = 3;
export const INGREDIENTS_MAX_LENGTH = 1000;

/** Заведение сообщило всё, что требуется до покупки: состав, аллергены (в том числе «аллергенов нет») и срок годности. */
export function hasFoodInfo(offer: { ingredients?: string | null; allergensDeclared?: boolean; bestBefore?: string | Date | null }): boolean {
  return !!offer.ingredients && offer.ingredients.trim().length >= INGREDIENTS_MIN_LENGTH && !!offer.allergensDeclared && !!offer.bestBefore;
}
