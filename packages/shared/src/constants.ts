/** Платформенные константы беты — см. допущения ШАГ 0. */

export const PLATFORM_COMMISSION_PERCENT = 25;

export const DISCOUNT_RULES = {
  BASE_PERCENT: 50,
  MAX_PERCENT: 70,
  /** >2 часов до pickupEnd — базовая скидка. */
  TIER_1_HOURS_BEFORE_END: 2,
  /** 1–2 часа до pickupEnd — базовая + 10%. */
  TIER_2_BONUS_PERCENT: 10,
  /** <1 часа до pickupEnd — базовая + 20% (капается MAX_PERCENT). */
  TIER_3_HOURS_BEFORE_END: 1,
  TIER_3_BONUS_PERCENT: 20,
} as const;

export const DISCOUNT_CRON_EXPRESSION = "*/15 * * * *";

export const PICKUP_CODE_LENGTH = 6;

/** Эко-баллы за 1 кг спасённого веса (EcoTransaction.points = weightSavedKg * ECO_POINTS_PER_KG). */
export const ECO_POINTS_PER_KG = 10;

export const DEFAULT_CURRENCY = "RUB";

export const DEFAULT_LOCALE = "ru";
