import { hasFoodInfo, OfferCategory, requiresFoodInfo, type Offer } from "@apetite/shared";
import type { FoodInfoSuggestion } from "../components/FoodInfoFields";

/** Состояние блока «Состав и срок годности» в формах оффера. bestBefore — значение <input type="datetime-local">. */
export interface FoodInfoState {
  ingredients: string;
  allergens: string[];
  /** Отметка «Аллергенов нет» — исключает выбор конкретных аллергенов. */
  noAllergens: boolean;
  bestBefore: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Срок годности по умолчанию — конец самовывоза + 4 часа (можно изменить): так в типичном случае заведению не нужно ничего вводить. */
export function defaultBestBefore(pickupEndLocal: string): string {
  const end = new Date(pickupEndLocal);
  if (Number.isNaN(end.getTime())) return "";
  return toLocalInput(new Date(end.getTime() + 4 * 3600_000));
}

export function foodInfoFromOffer(offer: Offer | undefined, pickupEndLocal: string): FoodInfoState {
  if (!offer || !hasFoodInfo(offer)) {
    return { ingredients: offer?.ingredients ?? "", allergens: [], noAllergens: false, bestBefore: offer?.bestBefore ? toLocalInput(new Date(offer.bestBefore)) : defaultBestBefore(pickupEndLocal) };
  }
  const allergens = offer.allergens ?? [];
  return {
    ingredients: offer.ingredients ?? "",
    allergens,
    noAllergens: allergens.length === 0,
    bestBefore: toLocalInput(new Date(offer.bestBefore as string)),
  };
}

export const EMPTY_FOOD_INFO = (pickupEndLocal: string): FoodInfoState => ({ ingredients: "", allergens: [], noAllergens: false, bestBefore: defaultBestBefore(pickupEndLocal) });

/** Текст ошибки, если для этой категории чего-то не хватает; null — всё в порядке. */
export function foodInfoError(category: OfferCategory, info: FoodInfoState, pickupEndLocal: string): string | null {
  if (!requiresFoodInfo(category)) return null;
  if (info.ingredients.trim().length < 3) return "Укажи состав: покупатель должен видеть его до оплаты";
  if (!info.noAllergens && info.allergens.length === 0) return "Отметь аллергены или выбери «Аллергенов нет»";
  if (!info.bestBefore) return "Укажи срок годности";
  if (new Date(info.bestBefore).getTime() < new Date(pickupEndLocal).getTime()) return "Срок годности не может заканчиваться раньше конца самовывоза";
  return null;
}

/** Поля для запроса create/update; пустой объект для категорий, где состав не нужен (цветы). */
export function foodInfoRequest(category: OfferCategory, info: FoodInfoState) {
  if (!requiresFoodInfo(category)) return {};
  return {
    ingredients: info.ingredients.trim(),
    allergens: info.noAllergens ? [] : info.allergens,
    bestBefore: new Date(info.bestBefore).toISOString(),
  };
}

/** Подсказки «подставить из прежних»: офферы заведения с заполненным составом, без повторов, свежие первыми. */
export function foodInfoSuggestions(offers: Offer[], limit = 8): FoodInfoSuggestion[] {
  const seen = new Set<string>();
  const result: FoodInfoSuggestion[] = [];
  for (const offer of [...offers].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (!hasFoodInfo(offer)) continue;
    const key = `${offer.ingredients}|${[...(offer.allergens ?? [])].sort().join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ title: offer.title, ingredients: offer.ingredients as string, allergens: offer.allergens ?? [] });
    if (result.length >= limit) break;
  }
  return result;
}
