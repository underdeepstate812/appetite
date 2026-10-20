import type { OfferSchedule } from "@apetite/shared";

export const DAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;
export const DAY_LONG = ["понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"] as const;

/** Часовой пояс браузера владельца: времена в шаблоне — «стенные часы» там, где их ввели. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow";
}

/** «ежедневно», «по будням», «по выходным», «пн, ср, пт» — человеческое описание набора дней. */
export function describeDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const key = sorted.join("");
  if (key === "1234567") return "ежедневно";
  if (key === "12345") return "по будням";
  if (key === "67") return "по выходным";
  return sorted.map((d) => DAY_SHORT[d - 1]).join(", ");
}

export const LEAD_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 0, label: "в момент начала самовывоза" },
  { minutes: 60, label: "за 1 час" },
  { minutes: 180, label: "за 3 часа" },
  { minutes: 360, label: "за 6 часов" },
  { minutes: 720, label: "за 12 часов (накануне вечером)" },
  { minutes: 1440, label: "за сутки" },
];

/** Время «ЧЧ:ММ» из значения <input type="datetime-local">. */
export const timeOf = (local: string): string => local.slice(11, 16);
export const dateOf = (local: string): string => local.slice(0, 10);

/** Сколько часов от конца самовывоза до срока годности (округляем вверх, не меньше 0) — для шаблона вместо конкретной даты. */
export function hoursBetween(fromLocal: string, toLocal: string): number {
  const diff = (new Date(toLocal).getTime() - new Date(fromLocal).getTime()) / 3_600_000;
  return Math.max(0, Math.ceil(diff - 1e-9));
}

/** Подпись шаблона: «по будням · 07:00–10:00 · на витрине за 3 часа». */
export function describeSchedule(s: Pick<OfferSchedule, "daysOfWeek" | "pickupStartTime" | "pickupEndTime" | "publishLeadMinutes">): string {
  const lead = LEAD_OPTIONS.find((o) => o.minutes === s.publishLeadMinutes)?.label ?? `за ${s.publishLeadMinutes} мин`;
  return `${describeDays(s.daysOfWeek)} · ${s.pickupStartTime}–${s.pickupEndTime} · на витрине ${lead}`;
}

export function formatOccurrenceDate(date: Date, timeZone: string): string {
  return date.toLocaleDateString("ru-RU", { weekday: "short", day: "2-digit", month: "2-digit", timeZone });
}
export function formatClock(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone });
}
