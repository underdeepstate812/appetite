/** Платформенные константы беты — см. допущения ШАГ 0. */

export const PLATFORM_COMMISSION_PERCENT = 25;

export const DISCOUNT_RULES = {
  /** Минимальная стартовая скидка, которую владелец бизнеса может выставить офферу. */
  MIN_BASE_PERCENT: 25,
  /** Скидка по умолчанию в форме создания оффера — владелец может понизить её до MIN_BASE_PERCENT. */
  DEFAULT_BASE_PERCENT: 50,
  MAX_PERCENT: 70,
  /** >2 часов до pickupEnd — стартовая скидка владельца, без надбавки. */
  TIER_1_HOURS_BEFORE_END: 2,
  /** 1–2 часа до pickupEnd — стартовая + 10%. */
  TIER_2_BONUS_PERCENT: 10,
  /** <1 часа до pickupEnd — стартовая + 20% (капается MAX_PERCENT). */
  TIER_3_HOURS_BEFORE_END: 1,
  TIER_3_BONUS_PERCENT: 20,
} as const;

/**
 * Текущий % скидки по правилу из ШАГ 5: чем ближе к концу самовывоза, тем
 * выше скидка поверх стартовой, которую задал владелец бизнеса (минимум
 * MIN_BASE_PERCENT). Одна реализация для шедулера, создания/редактирования
 * оффера и сид-данных — раньше это правило было продублировано в трёх местах.
 */
export function computeDiscountPercent(baseDiscountPercent: number, hoursToEnd: number): number {
  if (hoursToEnd < DISCOUNT_RULES.TIER_3_HOURS_BEFORE_END) {
    return Math.min(baseDiscountPercent + DISCOUNT_RULES.TIER_3_BONUS_PERCENT, DISCOUNT_RULES.MAX_PERCENT);
  }
  if (hoursToEnd < DISCOUNT_RULES.TIER_1_HOURS_BEFORE_END) {
    return Math.min(baseDiscountPercent + DISCOUNT_RULES.TIER_2_BONUS_PERCENT, DISCOUNT_RULES.MAX_PERCENT);
  }
  return baseDiscountPercent;
}

export const DISCOUNT_CRON_EXPRESSION = "*/15 * * * *";

/** Российский мобильный номер: +7 и ровно 10 цифр после кода страны. */
export const RU_PHONE_REGEX = /^\+7\d{10}$/;

export const PASSWORD_MIN_LENGTH = 8;
/** Минимум 8 символов + заглавная, строчная, цифра и спецсимвол — единое правило для backend и обеих фронт-форм. */
export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-zа-яё])(?=.*[A-ZА-ЯЁ])(?=.*\d)(?=.*[^A-Za-zА-Яа-яЁё\d]).{8,}$/;

export const PICKUP_CODE_LENGTH = 6;

/** Эко-баллы за 1 кг спасённого веса (EcoTransaction.points = weightSavedKg * ECO_POINTS_PER_KG). */
export const ECO_POINTS_PER_KG = 10;

export const DEFAULT_CURRENCY = "RUB";

export const DEFAULT_LOCALE = "ru";

/** Радиус по умолчанию для гео-уведомлений "рядом с тобой N предложений" (ШАГ 6), км. */
export const DEFAULT_NOTIFY_RADIUS_KM = 5;

/** Не слать повторный NEARBY_OFFERS-дайджест пользователю чаще, чем раз в это число часов. */
export const NEARBY_DIGEST_THROTTLE_HOURS = 3;

/** За сколько минут до pickupEnd слать PICKUP_REMINDER. */
export const PICKUP_REMINDER_WINDOW_MINUTES = 30;
