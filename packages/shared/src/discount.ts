import { DISCOUNT_RULES, computeDiscountPercent } from "./constants";
import { DiscountMode } from "./enums";

/**
 * Текущая скидка оффера с учётом режима. FIXED — всегда ровно та, что указал владелец; DYNAMIC — стартовая скидка плюс
 * надбавка по времени до конца самовывоза (computeDiscountPercent). Единая точка для создания, правки и шедулера.
 */
/** mode — строка, а не enum: у Prisma и у @apetite/shared свои, структурно несовместимые DiscountMode с одинаковыми значениями. */
export function currentDiscountPercent(mode: string | undefined | null, baseDiscountPercent: number, hoursToEnd: number): number {
  if (mode === DiscountMode.FIXED) return baseDiscountPercent;
  return computeDiscountPercent(baseDiscountPercent, hoursToEnd);
}

export interface DiscountStep {
  /** За сколько часов до конца самовывоза скидка становится такой. */
  hoursBeforeEnd: number;
  percent: number;
}

/**
 * Ступени скидки DYNAMIC-оффера от начала до конца окна: «50% → 60% за 2 ч → 70% за час». Ступени без прироста (скидка уже
 * упёрлась в потолок) не показываем. FIXED — одна ступень. Для подсказки в кабинете и на экране оффера.
 */
export function discountSteps(mode: string | undefined | null, baseDiscountPercent: number): DiscountStep[] {
  const first: DiscountStep = { hoursBeforeEnd: Infinity, percent: baseDiscountPercent };
  if (mode === DiscountMode.FIXED) return [first];
  const steps: DiscountStep[] = [first];
  const candidates: DiscountStep[] = [
    { hoursBeforeEnd: DISCOUNT_RULES.TIER_1_HOURS_BEFORE_END, percent: Math.min(baseDiscountPercent + DISCOUNT_RULES.TIER_2_BONUS_PERCENT, DISCOUNT_RULES.MAX_PERCENT) },
    { hoursBeforeEnd: DISCOUNT_RULES.TIER_3_HOURS_BEFORE_END, percent: Math.min(baseDiscountPercent + DISCOUNT_RULES.TIER_3_BONUS_PERCENT, DISCOUNT_RULES.MAX_PERCENT) },
  ];
  for (const step of candidates) if (step.percent > steps[steps.length - 1].percent) steps.push(step);
  return steps;
}

/**
 * Ближайшая ступень, на которую скидка ещё вырастет: когда (приблизительно — шедулер пересчитывает раз в 15 минут) и до
 * скольки процентов. null — у FIXED, на потолке или когда ступени уже позади.
 */
export function nextDiscountStep(
  mode: string | undefined | null,
  baseDiscountPercent: number,
  pickupEnd: Date | string,
  now: number = Date.now()
): { percent: number; at: Date } | null {
  const end = new Date(pickupEnd).getTime();
  const steps = discountSteps(mode, baseDiscountPercent);
  for (const step of steps.slice(1)) {
    const at = end - step.hoursBeforeEnd * 3_600_000;
    if (at > now) return { percent: step.percent, at: new Date(at) };
  }
  return null;
}
