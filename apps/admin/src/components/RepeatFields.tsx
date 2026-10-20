import { useMemo } from "react";
import { SCHEDULE_RULES, scheduleHoursProblem, upcomingOccurrences, validateScheduleTiming, type Business } from "@apetite/shared";
import { DayChips } from "./DayChips";
import { LEAD_OPTIONS, browserTimeZone, dateOf, describeDays, formatClock, formatOccurrenceDate, timeOf } from "../utils/schedule";

export interface RepeatState {
  enabled: boolean;
  daysOfWeek: number[];
  publishLeadMinutes: number;
  /** «ГГГГ-ММ-ДД» или пусто — без даты окончания. */
  endsOn: string;
}

export const DEFAULT_REPEAT: RepeatState = { enabled: false, daysOfWeek: [1, 2, 3, 4, 5], publishLeadMinutes: 180, endsOn: "" };

interface RepeatFieldsProps {
  idPrefix: string;
  value: RepeatState;
  onChange: (next: RepeatState) => void;
  /**
   * Начало и конец самовывоза из полей формы выше (значения datetime-local). Время суток берём отсюда, поэтому второй раз его не
   * вводят; дата начала — это первая (ручная) выкладка, её в предпросмотре «следующих» не повторяем.
   */
  pickupStart: string;
  pickupEnd: string;
  /** Для проверки по часам работы заведения. */
  business?: Pick<Business, "workingHours" | "timezone">;
}

/** Ошибка в настройках повторения (для формы) или null. Те же проверки, что на сервере. */
export function repeatError(value: RepeatState, pickupStart: string, pickupEnd: string, business?: Pick<Business, "workingHours" | "timezone">): string | null {
  if (!value.enabled) return null;
  const hours = (new Date(pickupEnd).getTime() - new Date(pickupStart).getTime()) / 3_600_000;
  // Шаблон хранит только время суток: окно длиннее 16 часов (или «на несколько дней») им не описать.
  if (hours > SCHEDULE_RULES.MAX_WINDOW_HOURS) return `Автовыкладка — для окон не длиннее ${SCHEDULE_RULES.MAX_WINDOW_HOURS} часов`;
  const timing = { daysOfWeek: value.daysOfWeek, pickupStartTime: timeOf(pickupStart), pickupEndTime: timeOf(pickupEnd), publishLeadMinutes: value.publishLeadMinutes, timezone: browserTimeZone(), endsOn: value.endsOn || null };
  const timingProblem = validateScheduleTiming(timing);
  if (timingProblem) return timingProblem;
  if (business?.workingHours) {
    if (timing.timezone !== business.timezone) return `Автовыкладка работает по часовому поясу заведения (${business.timezone}), а на этом устройстве — ${timing.timezone}`;
    return scheduleHoursProblem(business.workingHours, timing);
  }
  return null;
}

/**
 * «Повторять автоматически»: дни недели, за сколько до начала выкладывать, до какой даты. Время самовывоза берётся из полей
 * формы, поэтому здесь его не вводят второй раз. Внизу — предпросмотр ближайших выкладок: владелец видит результат, а не
 * абстрактную настройку.
 */
export function RepeatFields({ idPrefix, value, onChange, pickupStart, pickupEnd, business }: RepeatFieldsProps) {
  const timeZone = browserTimeZone();
  const pickupStartTime = timeOf(pickupStart);
  const pickupEndTime = timeOf(pickupEnd);
  const firstDate = dateOf(pickupStart);
  const error = repeatError(value, pickupStart, pickupEnd, business);
  const upcoming = useMemo(() => {
    if (!value.enabled || error) return [];
    const timing = { daysOfWeek: value.daysOfWeek, pickupStartTime, pickupEndTime, publishLeadMinutes: value.publishLeadMinutes, timezone: timeZone, endsOn: value.endsOn || null };
    return upcomingOccurrences(timing, Date.now(), 6).filter((o) => o.date !== firstDate).slice(0, 4);
  }, [value, error, pickupStartTime, pickupEndTime, timeZone, firstDate]);

  return (
    <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: "10px 14px 12px", margin: 0, minInlineSize: 0 }}>
      <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 6px" }}>Автовыкладка</legend>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <input
          id={`${idPrefix}-repeat`}
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
          style={{ width: 16, height: 16, margin: "3px 0 0", padding: 0, accentColor: "var(--color-primary)" }}
        />
        <span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Повторять автоматически</span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 2 }}>
            Не нужно каждый день вносить одно и то же: платформа сама выложит эту позицию в выбранные дни с теми же ценой, скидкой, количеством и составом.
          </span>
        </span>
      </label>

      {value.enabled ? (
        <div className="stack" style={{ gap: 12, marginTop: 12 }}>
          <DayChips idPrefix={idPrefix} value={value.daysOfWeek} onChange={(daysOfWeek) => onChange({ ...value, daysOfWeek })} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div className="field">
              <label htmlFor={`${idPrefix}-lead`}>Показывать на витрине</label>
              <select id={`${idPrefix}-lead`} value={value.publishLeadMinutes} onChange={(event) => onChange({ ...value, publishLeadMinutes: Number(event.target.value) })}>
                {LEAD_OPTIONS.map((option) => (
                  <option key={option.minutes} value={option.minutes}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-ends`}>Повторять до (необязательно)</label>
              <input id={`${idPrefix}-ends`} type="date" value={value.endsOn} onChange={(event) => onChange({ ...value, endsOn: event.target.value })} />
            </div>
          </div>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : (
            <div style={{ fontSize: 13, background: "var(--color-primary-soft)", borderRadius: 10, padding: "8px 12px" }} aria-live="polite">
              <strong>
                {describeDays(value.daysOfWeek)}, {pickupStartTime}–{pickupEndTime}
              </strong>
              <span style={{ color: "var(--color-text-muted)" }}> (по времени {timeZone})</span>
              {upcoming.length > 0 ? (
                <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 2, color: "var(--color-text-muted)" }}>
                  {upcoming.map((o) => (
                    <li key={o.date}>
                      Дальше: {formatOccurrenceDate(o.pickupStart, timeZone)}, {formatClock(o.pickupStart, timeZone)}–{formatClock(o.pickupEnd, timeZone)} · появится на витрине в {formatClock(o.publishAt, timeZone)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </fieldset>
  );
}
