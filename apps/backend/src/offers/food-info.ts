import { BadRequestException } from "@nestjs/common";
import {
  INGREDIENTS_MAX_LENGTH,
  INGREDIENTS_MIN_LENGTH,
  OFFER_ALLERGENS,
  OfferCategory,
  requiresFoodInfo,
} from "@apetite/shared";

export interface FoodInfoInput {
  /** Строка, а не enum: у Prisma и у @apetite/shared свои, структурно несовместимые OfferCategory с одинаковыми значениями. */
  category: string;
  ingredients?: string | null;
  /** undefined — заведение ничего не сообщило; [] — явно «аллергенов нет». */
  allergens?: string[] | null;
  bestBefore?: Date | null;
  pickupEnd: Date;
}

/**
 * Состав, аллергены и срок годности — то, что покупатель обязан увидеть ДО оплаты.
 * strict: для еды/выпечки/продуктов всё перечисленное обязательно (создание оффера или правка этих полей).
 * Без strict проверяем только согласованность уже указанного — чтобы старый оффер без состава (до появления поля)
 * можно было, например, снять с продажи или поменять количество, но нельзя было сделать срок годности раньше конца выдачи.
 */
export function assertFoodInfo(input: FoodInfoInput, strict: boolean): void {
  const ingredients = input.ingredients?.trim() ?? "";

  if (input.allergens) {
    const unknown = input.allergens.filter((code) => !(OFFER_ALLERGENS as readonly string[]).includes(code));
    if (unknown.length > 0) throw new BadRequestException(`Неизвестные аллергены: ${unknown.join(", ")}`);
  }
  if (ingredients.length > INGREDIENTS_MAX_LENGTH) {
    throw new BadRequestException(`Состав слишком длинный (не больше ${INGREDIENTS_MAX_LENGTH} символов)`);
  }
  if (input.bestBefore && input.bestBefore.getTime() < input.pickupEnd.getTime()) {
    throw new BadRequestException("Срок годности не может заканчиваться раньше конца времени самовывоза");
  }

  if (!strict || !requiresFoodInfo(input.category as OfferCategory)) return;

  if (ingredients.length < INGREDIENTS_MIN_LENGTH) {
    throw new BadRequestException("Укажите состав: покупатель должен видеть его до оплаты");
  }
  if (!input.allergens) {
    throw new BadRequestException("Укажите аллергены или отметьте, что их нет");
  }
  if (!input.bestBefore) {
    throw new BadRequestException("Укажите срок годности");
  }
}
