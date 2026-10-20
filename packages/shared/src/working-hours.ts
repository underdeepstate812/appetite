import { isTimeString, zonedParts } from "./schedule";

/**
 * Часы работы заведения. Ключ — ISO-день недели «1»…«7» (пн…вс), значение — интервал работы или null (выходной).
 * Время «ЧЧ:ММ» по часовому поясу заведения. Закрытие не позже открытия — работаем за полночь (18:00–02:00);
 * открытие = закрытие (например 00:00–00:00) — круглосуточно.
 * Самовывоз любого оффера обязан целиком уложиться в один рабочий интервал: заведение закрывается — оффер заканчивается.
 */
export interface WorkingInterval {
  open: string;
  close: string;
}
export type WorkingDayKey = "1" | "2" | "3" | "4" | "5" | "6" | "7";
export type WorkingHours = Record<WorkingDayKey, WorkingInterval | null>;

export const WORKING_DAY_KEYS: readonly WorkingDayKey[] = ["1", "2", "3", "4", "5", "6", "7"];
export const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;
const WEEKDAY_ON = ["в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу", "в воскресенье"] as const;
const DAY = 24 * 60;

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const hhmm = (minute: number) => {
  const m = ((minute % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Текст первой ошибки или null. Принимает «сырое» значение (из JSON запроса). */
export function validateWorkingHours(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "Часы работы: ожидается объект с днями недели 1–7";
  const record = value as Record<string, unknown>;
  const extra = Object.keys(record).filter((key) => !(WORKING_DAY_KEYS as readonly string[]).includes(key));
  if (extra.length > 0) return `Часы работы: неизвестные дни ${extra.join(", ")} (допустимы 1–7)`;
  let open = 0;
  for (const key of WORKING_DAY_KEYS) {
    const day = record[key];
    if (day === null || day === undefined) continue;
    if (typeof day !== "object" || Array.isArray(day)) return `Часы работы: день ${key} — ожидается {open, close} или null`;
    const { open: o, close: c } = day as Record<string, unknown>;
    if (typeof o !== "string" || typeof c !== "string" || !isTimeString(o) || !isTimeString(c)) return `Часы работы: время дня ${key} — в формате ЧЧ:ММ`;
    open += 1;
  }
  if (open === 0) return "Укажите хотя бы один рабочий день";
  return null;
}

/** Приводит проверенное значение к полному виду (все семь ключей). */
export function normalizeWorkingHours(value: unknown): WorkingHours {
  const record = value as Record<string, WorkingInterval | null | undefined>;
  const result = {} as WorkingHours;
  for (const key of WORKING_DAY_KEYS) {
    const day = record[key];
    result[key] = day ? { open: day.open, close: day.close } : null;
  }
  return result;
}

/** Рабочий интервал дня в минутах от полуночи этого дня: [open, close'], close' > 1440 — работа за полночь, и до сколько. */
function dayInterval(hours: WorkingHours, weekday: number): [number, number] | null {
  const day = hours[String(weekday) as WorkingDayKey];
  if (!day) return null;
  const open = minutesOf(day.open);
  const close = minutesOf(day.close);
  return [open, close <= open ? close + DAY : close];
}

/** Конец интервала с учётом того, что следующий день продолжает работу без перерыва (вс 00:00–00:00, пн 00:00–…). */
function chainedClose(hours: WorkingHours, weekday: number): number | null {
  const first = dayInterval(hours, weekday);
  if (!first) return null;
  let close = first[1];
  for (let step = 1; step <= 7 && close >= DAY * step; step += 1) {
    const next = dayInterval(hours, ((weekday - 1 + step) % 7) + 1);
    if (!next || next[0] > close - DAY * step) break;
    close = DAY * step + next[1];
  }
  return close;
}

export type HoursCheck =
  | { ok: true }
  | { ok: false; reason: "closed_day" | "not_open_yet" | "closed_already" | "after_close"; weekday: number; open?: string; close?: string; closeAt?: string };

/**
 * Помещается ли окно «с startMinute минут от полуночи дня weekday длиной durationMinutes» в рабочий интервал.
 * Работает и для расписаний (абстрактный день недели), и для конкретных офферов (см. checkOfferAgainstHours).
 */
export function checkWindowAgainstHours(hours: WorkingHours, weekday: number, startMinute: number, durationMinutes: number): HoursCheck {
  const today = dayInterval(hours, weekday);
  const previousWeekday = ((weekday + 5) % 7) + 1;
  const previous = dayInterval(hours, previousWeekday);
  const end = startMinute + durationMinutes;

  // Интервал, начавшийся накануне и идущий за полночь, может «накрывать» начало окна.
  const previousClose = chainedClose(hours, previousWeekday);
  if (previous && previousClose !== null && previousClose > DAY && startMinute < previousClose - DAY) {
    return end <= previousClose - DAY ? { ok: true } : { ok: false, reason: "after_close", weekday, closeAt: hhmm(previousClose) };
  }
  if (!today) return { ok: false, reason: "closed_day", weekday };
  const close = chainedClose(hours, weekday)!;
  const [open, ownClose] = today;
  if (startMinute < open) return { ok: false, reason: "not_open_yet", weekday, open: hhmm(open), close: hhmm(ownClose) };
  if (startMinute >= close) return { ok: false, reason: "closed_already", weekday, open: hhmm(open), close: hhmm(ownClose) };
  if (end > close) return { ok: false, reason: "after_close", weekday, open: hhmm(open), close: hhmm(ownClose), closeAt: hhmm(close) };
  return { ok: true };
}

/** Человеческая причина отказа. */
export function describeHoursProblem(check: HoursCheck): string | null {
  if (check.ok) return null;
  const when = WEEKDAY_ON[check.weekday - 1];
  switch (check.reason) {
    case "closed_day":
      return `Заведение ${when} не работает — выберите рабочий день или измените часы работы`;
    case "not_open_yet":
      return `Заведение ${when} открывается в ${check.open}: самовывоз не может начинаться раньше`;
    case "closed_already":
      return `Заведение ${when} уже закрыто (работает ${check.open}–${check.close}): самовывоз должен идти в часы работы`;
    case "after_close":
      return `Заведение ${when} закрывается в ${check.closeAt}: самовывоз должен закончиться не позже`;
  }
}

/** Конкретное окно оффера (моменты UTC) против часов работы в поясе заведения. Текст ошибки или null. */
export function offerWindowHoursProblem(hours: WorkingHours | null | undefined, timeZone: string, startMs: number, endMs: number): string | null {
  if (!hours) return null;
  const start = zonedParts(startMs, timeZone);
  const check = checkWindowAgainstHours(hours, start.weekday, start.minuteOfDay, Math.round((endMs - startMs) / 60_000));
  return describeHoursProblem(check);
}

/** Шаблон автовыкладки против часов работы: все выбранные дни должны помещаться. Текст первой ошибки или null. */
export function scheduleHoursProblem(
  hours: WorkingHours | null | undefined,
  timing: { daysOfWeek: number[]; pickupStartTime: string; pickupEndTime: string }
): string | null {
  if (!hours) return null;
  const start = minutesOf(timing.pickupStartTime);
  const rawEnd = minutesOf(timing.pickupEndTime);
  const duration = (rawEnd <= start ? rawEnd + DAY : rawEnd) - start;
  for (const weekday of timing.daysOfWeek) {
    const problem = describeHoursProblem(checkWindowAgainstHours(hours, weekday, start, duration));
    if (problem) return problem;
  }
  return null;
}

/** Закрытие рабочего интервала, внутри которого находится момент ms (абсолютное время UTC), или null — сейчас не работаем. */
export function closingTimeAt(hours: WorkingHours | null | undefined, timeZone: string, ms: number): number | null {
  if (!hours) return null;
  const now = zonedParts(ms, timeZone);
  const check = checkWindowAgainstHours(hours, now.weekday, now.minuteOfDay, 1);
  if (!check.ok) return check.reason === "after_close" ? ms : null; // закрытие меньше чем через минуту / сейчас не работаем
  // Окно длиннее — упираемся в закрытие: ищем самое длинное помещающееся (до двух суток) бинарным поиском по минутам.
  let low = 1;
  let high = 2 * DAY;
  if (checkWindowAgainstHours(hours, now.weekday, now.minuteOfDay, high).ok) return ms + high * 60_000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (checkWindowAgainstHours(hours, now.weekday, now.minuteOfDay, mid).ok) low = mid;
    else high = mid;
  }
  return ms + low * 60_000;
}

/** Сжатая подпись: «пн–пт 10:00–22:00 · сб–вс 11:00–23:00» (выходные — «вых.: ср»). */
export function describeWorkingHours(hours: WorkingHours | null | undefined): string {
  if (!hours) return "";
  const groups: Array<{ label: string; days: number[] }> = [];
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const day = hours[String(weekday) as WorkingDayKey];
    const label = day ? (minutesOf(day.open) === minutesOf(day.close) ? "круглосуточно" : `${day.open}–${day.close}`) : "выходной";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.days.push(weekday);
    else groups.push({ label, days: [weekday] });
  }
  return groups
    .map(({ label, days }) => `${days.length === 1 ? WEEKDAY_SHORT[days[0] - 1] : `${WEEKDAY_SHORT[days[0] - 1]}–${WEEKDAY_SHORT[days[days.length - 1] - 1]}`} ${label}`)
    .join(" · ");
}

/** Часы работы по умолчанию для формы: ежедневно 10:00–22:00. */
export function defaultWorkingHours(): WorkingHours {
  const day = { open: "10:00", close: "22:00" };
  return { "1": { ...day }, "2": { ...day }, "3": { ...day }, "4": { ...day }, "5": { ...day }, "6": { ...day }, "7": { ...day } };
}
