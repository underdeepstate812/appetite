import type { Business } from "@apetite/shared";

export function isInTrial(business: Pick<Business, "trialEndsAt">): boolean {
  return !!business.trialEndsAt && new Date(business.trialEndsAt) > new Date();
}

/**
 * Сколько реально получит заведение с одной продажи по цене витрины (после
 * удержания агентского вознаграждения платформы) — тот же расчёт, что и
 * apps/backend/src/orders/orders.service.ts (Math.round(price * commission / 100)),
 * продублирован на фронте для мгновенной подсказки без похода на сервер.
 * В пробный период (см. Business.trialEndsAt) комиссия фактически 0%.
 */
export function computeNetPayout(displayPriceRub: number, business: Pick<Business, "commissionPercent" | "trialEndsAt">): number {
  if (isInTrial(business)) return displayPriceRub;
  return Math.round(displayPriceRub * (1 - business.commissionPercent / 100) * 100) / 100;
}
