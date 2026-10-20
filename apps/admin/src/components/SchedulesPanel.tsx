import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Pause, Play, Trash2 } from "lucide-react";
import { DiscountMode, scheduleHoursProblem, upcomingOccurrences, zonedParts, type Business, type OfferSchedule } from "@apetite/shared";
import { offerSchedulesApi } from "../api/offerSchedules";
import { ApiError } from "../api/client";
import { CATEGORY_LABELS } from "../constants";
import { describeSchedule, formatClock, formatOccurrenceDate } from "../utils/schedule";
import { ScheduleFormModal } from "./ScheduleFormModal";

/**
 * «Автовыкладка»: шаблоны, по которым платформа сама выкладывает офферы. Для каждого — расписание человеческим языком,
 * ближайшие выкладки (каждую можно пропустить: праздник, выходной), пауза, правка и удаление. Удаление шаблона не снимает
 * уже выложенные офферы с витрины.
 */
export function SchedulesPanel({ business, onChanged }: { business: Business; onChanged: () => void }) {
  const [schedules, setSchedules] = useState<OfferSchedule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<OfferSchedule | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSchedules(await offerSchedulesApi.list(business.id));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить шаблоны");
    }
  }, [business.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      await load();
      onChanged();
    } catch (actionError) {
      setError(actionError instanceof ApiError ? actionError.message : "Не удалось выполнить действие");
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = (schedule: OfferSchedule) => run(schedule.id, async () => void (await offerSchedulesApi.update(schedule.id, { isActive: !schedule.isActive })));
  const remove = (schedule: OfferSchedule) => {
    if (!confirm(`Удалить шаблон «${schedule.title}»? Уже выложенные офферы останутся в продаже, новые выкладываться не будут.`)) return;
    return run(schedule.id, async () => void (await offerSchedulesApi.remove(schedule.id)));
  };
  const skip = (schedule: OfferSchedule, date: string) =>
    run(schedule.id, async () => {
      const result = await offerSchedulesApi.skip(schedule.id, date);
      if (result.archivedOfferId) setNotice("Оффер на эту дату уже был выложен — снят с витрины (по нему никто не заказывал).");
      else if (result.keptBecauseOrders) setNotice("Оффер на эту дату уже заказывали, поэтому он остаётся в продаже; дальше выкладки не будет.");
    });
  const unskip = (schedule: OfferSchedule, date: string) => run(schedule.id, async () => void (await offerSchedulesApi.unskip(schedule.id, date)));

  return (
    <section className="card" style={{ padding: "18px 20px" }} aria-labelledby="schedules-title">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <CalendarClock size={18} color="var(--color-primary)" aria-hidden="true" />
        <h2 id="schedules-title" style={{ fontSize: 16, fontWeight: 800 }}>
          Автовыкладка
        </h2>
      </div>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
        Позиции, которые выкладываются сами в выбранные дни. Чтобы добавить новую, создайте оффер кнопкой «+ Новый оффер» и включите «Повторять автоматически».
      </p>

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" style={{ marginTop: 10, fontSize: 13, background: "var(--color-primary-soft)", borderRadius: 10, padding: "8px 12px" }}>
          {notice}
        </p>
      ) : null}

      {schedules === null ? (
        <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-text-muted)" }}>Загрузка…</p>
      ) : schedules.length === 0 ? (
        <p style={{ marginTop: 12, fontSize: 14 }}>Шаблонов пока нет.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 12 }}>
          {schedules.map((schedule) => (
            <ScheduleRow key={schedule.id} schedule={schedule} hoursProblem={scheduleHoursProblem(business.workingHours, schedule)} busy={busy === schedule.id} onToggle={() => void toggleActive(schedule)} onEdit={() => setEditing(schedule)} onRemove={() => void remove(schedule)} onSkip={(date) => void skip(schedule, date)} onUnskip={(date) => void unskip(schedule, date)} />
          ))}
        </ul>
      )}

      {editing ? (
        <ScheduleFormModal
          business={business}
          schedule={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
            onChanged();
          }}
        />
      ) : null}
    </section>
  );
}

interface ScheduleRowProps {
  schedule: OfferSchedule;
  /** Шаблон не влезает в часы работы (их поменяли позже): выкладка пропускается, пока время не поправят. */
  hoursProblem: string | null;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onSkip: (date: string) => void;
  onUnskip: (date: string) => void;
}

function ScheduleRow({ schedule, hoursProblem, busy, onToggle, onEdit, onRemove, onSkip, onUnskip }: ScheduleRowProps) {
  const tz = schedule.timezone;
  const today = zonedParts(Date.now(), tz).date;
  const finished = !!schedule.endsOn && schedule.endsOn < today;
  const upcoming = useMemo(() => upcomingOccurrences(schedule, Date.now(), 3), [schedule]);
  const state = finished ? { label: "закончился", className: "badge-muted" } : schedule.isActive ? { label: "работает", className: "badge-success" } : { label: "на паузе", className: "badge-warning" };

  return (
    <li style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 14px", opacity: schedule.isActive && !finished ? 1 : 0.85 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15 }}>{schedule.title}</strong>
            <span className={`badge ${state.className}`}>{state.label}</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}>
            {CATEGORY_LABELS[schedule.category]} · {(schedule.originalPrice / 100).toFixed(0)} ₽ · −{schedule.baseDiscountPercent}% {schedule.discountMode === DiscountMode.FIXED ? "(фиксированная)" : "(растёт к концу)"} · {schedule.quantityTotal} шт
          </p>
          <p style={{ fontSize: 13, marginTop: 2 }}>{describeSchedule(schedule)}</p>
          {hoursProblem && schedule.isActive ? (
            <p role="alert" data-testid="schedule-hours-warning" style={{ fontSize: 12.5, marginTop: 6, padding: "6px 10px", borderRadius: 8, background: "var(--color-warning-soft)", color: "var(--color-warning)", fontWeight: 600 }}>
              Не выкладывается: {hoursProblem}. Поправьте время шаблона или часы работы.
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={onToggle} disabled={busy || finished} aria-label={schedule.isActive ? `Поставить на паузу «${schedule.title}»` : `Включить «${schedule.title}»`}>
            {schedule.isActive ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            {schedule.isActive ? "Пауза" : "Включить"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onEdit} disabled={busy}>
            Изменить
          </button>
          <button className="btn btn-danger btn-sm" onClick={onRemove} disabled={busy} aria-label={`Удалить шаблон «${schedule.title}»`}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {upcoming.length > 0 && !finished ? (
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>Ближайшие выкладки</span>
          <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {upcoming.map((o) => (
              <li key={o.date} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 6px 4px 10px", borderRadius: 999, background: o.skipped ? "var(--color-surface)" : "var(--color-primary-soft)", fontSize: 12.5, border: o.skipped ? "1px dashed var(--color-border)" : "1px solid transparent" }}>
                <span style={{ textDecoration: o.skipped ? "line-through" : "none", color: o.skipped ? "var(--color-text-muted)" : "var(--color-text)" }}>
                  {formatOccurrenceDate(o.pickupStart, tz)} · {formatClock(o.pickupStart, tz)}–{formatClock(o.pickupEnd, tz)}
                </span>
                <button
                  type="button"
                  disabled={busy || !schedule.isActive}
                  onClick={() => (o.skipped ? onUnskip(o.date) : onSkip(o.date))}
                  style={{ border: "none", background: "transparent", color: "var(--color-primary)", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: "2px 4px", minHeight: 24 }}
                  aria-label={`${o.skipped ? "Вернуть" : "Пропустить"} выкладку ${formatOccurrenceDate(o.pickupStart, tz)}`}
                >
                  {o.skipped ? "вернуть" : "пропустить"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
