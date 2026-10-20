import { WORKING_DAY_KEYS, zonedParts, type WorkingHours } from "@apetite/shared";

/** «10:00–22:00» / «круглосуточно» / «выходной» для дня, на который приходится момент ms (в поясе заведения). null — часы не заданы. */
export function dayHoursLabel(hours: WorkingHours | null | undefined, timeZone: string, ms: number): string | null {
  if (!hours || Number.isNaN(ms)) return null;
  const weekday = zonedParts(ms, timeZone).weekday;
  const day = hours[WORKING_DAY_KEYS[weekday - 1]];
  if (!day) return "выходной";
  return day.open === day.close ? "круглосуточно" : `${day.open}–${day.close}`;
}
