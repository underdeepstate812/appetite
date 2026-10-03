export type OrderStage = "confirmed" | "preparing" | "ready";

/**
 * Готовность (0..1) от момента подтверждения заведением до начала окна самовывоза. До подтверждения
 * готовка физически не началась — 0, а не «фейковый» процент от момента оплаты (как в мобильном приложении).
 */
export function getReadiness(acceptedAtIso: string | null | undefined, pickupStartIso: string, now: number = Date.now()): number {
  const start = new Date(pickupStartIso).getTime();
  if (now >= start) return 1;
  const accepted = acceptedAtIso ? new Date(acceptedAtIso).getTime() : NaN;
  if (Number.isNaN(accepted) || accepted >= start) return 0;
  return Math.min(1, Math.max(0, (now - accepted) / (start - accepted)));
}

/**
 * «Оплачено → готовится → можно забирать». Отдельного бэкенд-статуса на промежуточные стадии нет
 * (Order.status только CONFIRMED/COMPLETED/…), поэтому стадия выводится из acceptedAt и времени окна.
 * «Готовится» нельзя показывать до подтверждения заведением — иначе экран утверждает «уже готовят»,
 * хотя заведение заказ ещё не видело.
 */
export function getOrderStage(acceptedAt: string | null | undefined, pickupStart: string, now: number = Date.now()): OrderStage {
  if (now >= new Date(pickupStart).getTime()) return "ready";
  return acceptedAt ? "preparing" : "confirmed";
}
