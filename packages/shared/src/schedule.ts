import { OfferCategory } from "./enums";
import { requiresFoodInfo } from "./food-info";

/** Правила автовыкладки и «завтрака» — одни числа для backend, кабинета и мобильного приложения. */
export const SCHEDULE_RULES = {
  MAX_PER_BUSINESS: 20,
  MIN_WINDOW_MINUTES: 15,
  MAX_WINDOW_HOURS: 12,
  MAX_LEAD_MINUTES: 24 * 60,
  /** Витрина заранее показывает оффер за столько минут до начала самовывоза (если заведение не выбрало иначе). */
  DEFAULT_LEAD_MINUTES: 180,
  /** Если сервис «проспал» выкладку, догоняем её только пока до конца окна осталось не меньше этого (иначе окно бессмысленно коротко). */
  MIN_REMAINING_MINUTES: 20,
  MAX_SKIP_DATES: 60,
  DEFAULT_TIMEZONE: "Europe/Moscow",
} as const;

/**
 * Правила жизни любого оффера (вручную и по шаблону): заведения закрываются, а витрина обновляется каждые сутки —
 * окно самовывоза не длиннее MAX_WINDOW_HOURS, а от выкладки до конца окна проходит не больше MAX_LIFETIME_HOURS.
 * Поэтому «вечного» оффера на 22 часа с горячей скидкой быть не может: горячим он становится только к концу окна.
 */
export const OFFER_WINDOW_RULES = {
  MAX_WINDOW_HOURS: SCHEDULE_RULES.MAX_WINDOW_HOURS,
  MAX_LIFETIME_HOURS: 24,
} as const;

/** Текст первой ошибки окна самовывоза конкретного оффера или null. now — «когда выкладывают»; horizon проверяем, только когда конец окна задаётся заново. */
export function validateOfferWindow(startMs: number, endMs: number, opts: { nowMs: number; checkHorizon: boolean }): string | null {
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return "Некорректная дата окна самовывоза";
  if (endMs <= startMs) return "Окно самовывоза: конец должен быть позже начала";
  if ((endMs - startMs) / 3_600_000 > OFFER_WINDOW_RULES.MAX_WINDOW_HOURS) {
    return `Окно самовывоза — не длиннее ${OFFER_WINDOW_RULES.MAX_WINDOW_HOURS} часов: заведение закрывается, а предложения обновляются каждые сутки`;
  }
  if (opts.checkHorizon && (endMs - opts.nowMs) / 3_600_000 > OFFER_WINDOW_RULES.MAX_LIFETIME_HOURS) {
    return `Оффер не может висеть дольше ${OFFER_WINDOW_RULES.MAX_LIFETIME_HOURS} часов: конец самовывоза — не позже, чем через сутки`;
  }
  return null;
}

export const BREAKFAST_RULES = {
  /** «До 10 утра» — граница включительно: окно, закрывающееся ровно в 10:00, ещё завтрак. */
  CUTOFF_MINUTES: 10 * 60,
  /** Вкладка «Завтрак» живёт по времени пилотного города, а не по часам телефона (путешественник не получает «завтрак» в полдень). */
  TIMEZONE: "Europe/Moscow",
} as const;

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    formatters.set(timeZone, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** ISO: 1 = понедельник … 7 = воскресенье. */
  weekday: number;
  /** «YYYY-MM-DD» в этом часовом поясе. */
  date: string;
  /** Минут от местной полуночи. */
  minuteOfDay: number;
}

/** Календарные части момента времени в заданном часовом поясе (IANA). Бросает RangeError на неизвестном поясе. */
export function zonedParts(moment: Date | number, timeZone: string): ZonedParts {
  const ms = typeof moment === "number" ? moment : moment.getTime();
  const raw: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(new Date(ms))) {
    if (part.type !== "literal") raw[part.type] = Number(part.value);
  }
  const { year, month, day, hour, minute, second } = raw;
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return { year, month, day, hour, minute, second, weekday: jsDay === 0 ? 7 : jsDay, date: `${pad(year, 4)}-${pad(month)}-${pad(day)}`, minuteOfDay: hour * 60 + minute };
}

/** «Стенное» время в поясе как если бы оно было UTC — разница с настоящим моментом даёт смещение пояса. */
function wallAsUtc(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/**
 * Момент времени (UTC), когда в поясе timeZone на часах «dateStr timeStr». На переходе на летнее время несуществующее время
 * сдвигается вперёд, двусмысленное (повтор часа) берётся первым — выкладка не выпадает и не дублируется.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Смещения до и после ближайшего перехода (сутки в обе стороны). Подходит тот кандидат, у которого «стенные» часы совпали.
  const before = wallAsUtc(guess - DAY_MS, timeZone) - (guess - DAY_MS);
  const after = wallAsUtc(guess + DAY_MS, timeZone) - (guess + DAY_MS);
  const fits = [guess - before, guess - after].filter((candidate) => wallAsUtc(candidate, timeZone) === guess);
  if (fits.length > 0) return new Date(Math.min(...fits)); // повтор часа — берём первый
  return new Date(guess - Math.min(before, after)); // «дыра» весной: сдвигаем вперёд, к первому существующему времени
}

/** «YYYY-MM-DD» плюс n суток (календарная арифметика, без часовых поясов). */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isDateString = (value: string): boolean => DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
export const isTimeString = (value: string): boolean => TIME_RE.test(value);
const minutesOf = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Поля шаблона, от которых зависит расписание (всё остальное — содержимое оффера). */
export interface ScheduleTiming {
  daysOfWeek: number[];
  pickupStartTime: string;
  pickupEndTime: string;
  publishLeadMinutes: number;
  timezone: string;
  startsOn?: string | null;
  endsOn?: string | null;
  skipDates?: string[];
  isActive?: boolean;
}

/** Длительность окна в минутах: конец не позже начала — окно заканчивается на следующие сутки. */
export function windowMinutes(start: string, end: string): number {
  const diff = minutesOf(end) - minutesOf(start);
  return diff > 0 ? diff : diff + 24 * 60;
}

/** Текст первой ошибки в расписании или null, если всё верно. Те же проверки — в форме кабинета и на сервере. */
export function validateScheduleTiming(s: ScheduleTiming): string | null {
  if (!Array.isArray(s.daysOfWeek) || s.daysOfWeek.length === 0) return "Выберите хотя бы один день недели";
  if (new Set(s.daysOfWeek).size !== s.daysOfWeek.length || s.daysOfWeek.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return "Дни недели: числа от 1 (пн) до 7 (вс), без повторов";
  if (!isTimeString(s.pickupStartTime) || !isTimeString(s.pickupEndTime)) return "Время самовывоза — в формате ЧЧ:ММ";
  const minutes = windowMinutes(s.pickupStartTime, s.pickupEndTime);
  if (minutes < SCHEDULE_RULES.MIN_WINDOW_MINUTES) return `Окно самовывоза — не короче ${SCHEDULE_RULES.MIN_WINDOW_MINUTES} минут`;
  if (minutes > SCHEDULE_RULES.MAX_WINDOW_HOURS * 60) return `Окно самовывоза — не длиннее ${SCHEDULE_RULES.MAX_WINDOW_HOURS} часов`;
  if (!Number.isInteger(s.publishLeadMinutes) || s.publishLeadMinutes < 0 || s.publishLeadMinutes > SCHEDULE_RULES.MAX_LEAD_MINUTES) return "Выкладка заранее — от 0 минут до суток";
  if (s.publishLeadMinutes + minutes > OFFER_WINDOW_RULES.MAX_LIFETIME_HOURS * 60) return `«Показывать на витрине заранее» вместе с окном самовывоза — не больше ${OFFER_WINDOW_RULES.MAX_LIFETIME_HOURS} часов: оффер не живёт дольше суток`;
  if (!isValidTimeZone(s.timezone)) return "Неизвестный часовой пояс";
  if (s.startsOn && !isDateString(s.startsOn)) return "Дата начала — в формате ГГГГ-ММ-ДД";
  if (s.endsOn && !isDateString(s.endsOn)) return "Дата окончания — в формате ГГГГ-ММ-ДД";
  if (s.startsOn && s.endsOn && s.endsOn < s.startsOn) return "Дата окончания раньше даты начала";
  const skips = s.skipDates ?? [];
  if (skips.length > SCHEDULE_RULES.MAX_SKIP_DATES || skips.some((d) => !isDateString(d))) return "Пропуски — до 60 дат в формате ГГГГ-ММ-ДД";
  return null;
}

export interface Occurrence {
  /** Локальная дата начала самовывоза «YYYY-MM-DD» — ключ идемпотентности: один оффер на шаблон и дату. */
  date: string;
  pickupStart: Date;
  pickupEnd: Date;
  /** Когда оффер появляется на витрине: начало минус publishLeadMinutes. */
  publishAt: Date;
  /** Дата в списке пропусков — оффер выкладываться не будет. */
  skipped: boolean;
}

/** Выкладка шаблона на локальную дату или null: день недели не подходит либо дата вне границ startsOn…endsOn. */
export function occurrenceOn(s: ScheduleTiming, date: string): Occurrence | null {
  const weekday = zonedParts(zonedTimeToUtc(date, "12:00", s.timezone), s.timezone).weekday;
  if (!s.daysOfWeek.includes(weekday)) return null;
  if (s.startsOn && date < s.startsOn) return null;
  if (s.endsOn && date > s.endsOn) return null;
  const endDate = minutesOf(s.pickupEndTime) <= minutesOf(s.pickupStartTime) ? addDays(date, 1) : date;
  const pickupStart = zonedTimeToUtc(date, s.pickupStartTime, s.timezone);
  const pickupEnd = zonedTimeToUtc(endDate, s.pickupEndTime, s.timezone);
  return { date, pickupStart, pickupEnd, publishAt: new Date(pickupStart.getTime() - s.publishLeadMinutes * 60_000), skipped: (s.skipDates ?? []).includes(date) };
}

/**
 * Выкладки, которые пора создать сейчас: время публикации наступило, окно ещё не закончилось (с запасом MIN_REMAINING_MINUTES —
 * «догоняем» проспанную выкладку, но не публикуем офферы с окном в пару минут), дата не пропущена. Смотрим вчера/сегодня/завтра по
 * местному календарю: окно через полночь и заблаговременная публикация могут относиться к соседней дате.
 */
export function dueOccurrences(s: ScheduleTiming, now: number = Date.now()): Occurrence[] {
  if (s.isActive === false) return [];
  const today = zonedParts(now, s.timezone).date;
  const due: Occurrence[] = [];
  for (const date of [addDays(today, -1), today, addDays(today, 1)]) {
    const occurrence = occurrenceOn(s, date);
    if (!occurrence || occurrence.skipped) continue;
    if (occurrence.publishAt.getTime() <= now && occurrence.pickupEnd.getTime() - now >= SCHEDULE_RULES.MIN_REMAINING_MINUTES * 60_000) due.push(occurrence);
  }
  return due;
}

/** Ближайшие `count` выкладок (в том числе пропущенные — с флагом skipped) для предпросмотра в кабинете. */
export function upcomingOccurrences(s: ScheduleTiming, now: number = Date.now(), count = 7, maxDays = 60): Occurrence[] {
  const result: Occurrence[] = [];
  const today = zonedParts(now, s.timezone).date;
  for (let i = -1; i <= maxDays && result.length < count; i += 1) {
    const occurrence = occurrenceOn(s, addDays(today, i));
    if (occurrence && occurrence.pickupEnd.getTime() > now) result.push(occurrence);
  }
  return result;
}

/** Сейчас «утро до 10»: вкладка «Завтрак» на экране показывается только в это время. */
export function isBreakfastTime(now: number = Date.now()): boolean {
  return zonedParts(now, BREAKFAST_RULES.TIMEZONE).minuteOfDay < BREAKFAST_RULES.CUTOFF_MINUTES;
}

/**
 * Через сколько миллисекунд меняется состояние вкладки «Завтрак»: пока она показана — до 10:00, пока скрыта — до ближайшей
 * местной полуночи (с неё она снова появляется). Нужен, чтобы вкладка исчезала ровно в 10:00, а не на следующем «тике».
 */
export function msUntilBreakfastFlip(now: number = Date.now()): number {
  const today = zonedParts(now, BREAKFAST_RULES.TIMEZONE).date;
  const target = isBreakfastTime(now) ? zonedTimeToUtc(today, "10:00", BREAKFAST_RULES.TIMEZONE) : zonedTimeToUtc(addDays(today, 1), "00:00", BREAKFAST_RULES.TIMEZONE);
  return Math.max(0, target.getTime() - now);
}

/**
 * Предложение — «завтрак»: окно самовывоза закрывается СЕГОДНЯ не позже 10:00 (по времени пилотного города) и ещё не закрылось.
 * Предложение с окном 08:00–12:00 — не завтрак (оно доступно и после 10), а 06:00–10:00 или 08:00–09:30 — да, даже если
 * окно ещё не открылось.
 */
export function isBreakfastOffer(offer: { pickupEnd: string | Date }, now: number = Date.now()): boolean {
  const end = new Date(offer.pickupEnd).getTime();
  if (end <= now) return false;
  const endParts = zonedParts(end, BREAKFAST_RULES.TIMEZONE);
  return endParts.date === zonedParts(now, BREAKFAST_RULES.TIMEZONE).date && endParts.minuteOfDay <= BREAKFAST_RULES.CUTOFF_MINUTES;
}

/** Срок годности для выложенного оффера: конец самовывоза + часы из шаблона (для еды обязателен — иначе null). */
export function bestBeforeFor(pickupEnd: Date, hoursAfterEnd: number | null | undefined, category: OfferCategory): Date | null {
  if (hoursAfterEnd === null || hoursAfterEnd === undefined) return requiresFoodInfo(category) ? pickupEnd : null;
  return new Date(pickupEnd.getTime() + hoursAfterEnd * 3_600_000);
}
