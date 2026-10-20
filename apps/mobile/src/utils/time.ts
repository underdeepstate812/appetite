/**
 * TimeLeft/getTimeLeft/getUrgencyLevel/getUrgencyRatio вынесены в @apetite/shared —
 * теперь и web (маркеры на карте) считает срочность тем же правилом. Реэкспорт
 * сохраняет старый путь импорта, которым пользуются существующие компоненты.
 */
export type { TimeLeft, UrgencyLevel } from "@apetite/shared";
export { getTimeLeft, getUrgencyLevel, getUrgencyRatio } from "@apetite/shared";

/**
 * Степень готовности заказа 0..1: доля пути от момента заказа до начала окна выдачи.
 * Когда окно уже открыто (или заказали сразу внутри него) — заказ готов, 1.
 * Отдельного серверного статуса "готовится" нет, поэтому готовность выводится из времени.
 * Специфично для заказов (mobile-only) — в @apetite/shared не переносилось.
 */
export function getReadiness(orderedAtIso: string | undefined, pickupStartIso: string, now: number = Date.now()): number {
  const start = new Date(pickupStartIso).getTime();
  if (now >= start) return 1;
  const ordered = orderedAtIso ? new Date(orderedAtIso).getTime() : NaN;
  if (Number.isNaN(ordered) || ordered >= start) return 0;
  return Math.min(1, Math.max(0, (now - ordered) / (start - ordered)));
}
