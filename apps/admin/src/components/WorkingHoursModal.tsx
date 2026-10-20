import { useState, type FormEvent } from "react";
import { WEEKDAY_SHORT, WORKING_DAY_KEYS, defaultWorkingHours, normalizeWorkingHours, validateWorkingHours, type WorkingHours } from "@apetite/shared";
import { Modal } from "./Modal";
import { ApiError } from "../api/client";
import { useBusinessStore } from "../store/businessStore";
import type { WorkingHoursConflicts } from "../api/businesses";

const DAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"] as const;
const isAllDay = (day: { open: string; close: string }) => day.open === day.close;

/**
 * Часы работы заведения. Самовывоз любого оффера обязан целиком уложиться в них: заведение закрывается — оффер заканчивается.
 * После сохранения показываем, что из уже выложенного в новые часы не влезает (его не трогаем).
 */
export function WorkingHoursModal({ initial, timeZone, onClose }: { initial: WorkingHours | null | undefined; timeZone: string; onClose: () => void }) {
  const setWorkingHours = useBusinessStore((state) => state.setWorkingHours);
  const [hours, setHours] = useState<WorkingHours>(() => (initial ? normalizeWorkingHours(initial) : defaultWorkingHours()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<WorkingHoursConflicts | null>(null);

  const patchDay = (key: (typeof WORKING_DAY_KEYS)[number], next: { open: string; close: string } | null) => setHours((prev) => ({ ...prev, [key]: next }));
  const firstOpen = WORKING_DAY_KEYS.map((key) => hours[key]).find(Boolean) ?? null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateWorkingHours(hours);
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      setConflicts(await setWorkingHours(hours));
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Не удалось сохранить часы работы");
    } finally {
      setSaving(false);
    }
  };

  if (conflicts) {
    const total = conflicts.offers.length + conflicts.schedules.length;
    return (
      <Modal title="Часы работы сохранены" onClose={onClose}>
        <div className="stack" style={{ gap: 14 }}>
          {total === 0 ? (
            <p role="status">Всё выложенное укладывается в новые часы. Теперь каждое предложение будет заканчиваться до закрытия.</p>
          ) : (
            <>
              <p role="status" style={{ fontWeight: 600 }}>Часть выложенного в новые часы не влезает. Мы ничего не меняли:</p>
              {conflicts.offers.length > 0 ? (
                <div>
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Эти предложения доживут до конца своего окна, а новые такие же создать уже не получится:</p>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 14 }}>
                    {conflicts.offers.map((item) => (
                      <li key={item.id}><b>{item.title}</b> — {item.reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {conflicts.schedules.length > 0 ? (
                <div>
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Эти шаблоны автовыкладки перестанут выкладывать офферы, пока вы не поправите время:</p>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 14 }}>
                    {conflicts.schedules.map((item) => (
                      <li key={item.id}><b>{item.title}</b> — {item.reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
          <button className="btn btn-primary" onClick={onClose}>Понятно</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Часы работы" onClose={onClose}>
      <form className="stack" style={{ gap: 12 }} onSubmit={handleSubmit}>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Заведение закрывается — и предложение заканчивается. Самовывоз каждого оффера обязан уложиться в эти часы ({timeZone}).
        </p>
        <div role="group" aria-label="Часы работы по дням" className="stack" style={{ gap: 8 }}>
          {WORKING_DAY_KEYS.map((key, index) => {
            const day = hours[key];
            return (
              <div key={key} data-day={key} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 140px) 1fr", alignItems: "center", gap: 10 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={!!day}
                    onChange={(event) => patchDay(key, event.target.checked ? { ...(firstOpen ?? { open: "10:00", close: "22:00" }) } : null)}
                    aria-label={`${DAY_NAMES[index]}: работаем`}
                  />
                  {WEEKDAY_SHORT[index]}
                </label>
                {day ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input type="time" value={day.open} onChange={(event) => patchDay(key, { ...day, open: event.target.value })} aria-label={`${DAY_NAMES[index]}: открытие`} required style={{ width: 110 }} />
                    <span aria-hidden="true">—</span>
                    <input type="time" value={day.close} onChange={(event) => patchDay(key, { ...day, close: event.target.value })} aria-label={`${DAY_NAMES[index]}: закрытие`} required style={{ width: 110 }} />
                    {isAllDay(day) ? (
                      <span className="badge badge-success">круглосуточно</span>
                    ) : day.close < day.open ? (
                      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>до {day.close} следующего дня</span>
                    ) : null}
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>выходной</span>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!firstOpen} onClick={() => firstOpen && setHours(() => Object.fromEntries(WORKING_DAY_KEYS.map((key) => [key, { ...firstOpen }])) as WorkingHours)}>
            Как в первый рабочий день — на всю неделю
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHours(() => Object.fromEntries(WORKING_DAY_KEYS.map((key) => [key, { open: "00:00", close: "00:00" }])) as WorkingHours)}>
            Круглосуточно
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Закрытие раньше открытия — работаем за полночь (например, 18:00–02:00). Одинаковое время — круглосуточно.</p>
        {error ? <p role="alert" className="form-error">{error}</p> : null}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Сохраняем..." : "Сохранить часы работы"}</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
        </div>
      </form>
    </Modal>
  );
}
