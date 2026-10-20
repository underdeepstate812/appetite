import { useState } from "react";
import { Clock } from "lucide-react";
import { closingTimeAt, describeWorkingHours, type Business } from "@apetite/shared";
import { WorkingHoursModal } from "./WorkingHoursModal";

const clock = (ms: number, timeZone: string) => new Date(ms).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone });

/**
 * Часы работы на странице «Офферы»: пока не заданы — призыв указать (без них предложение не привязано к закрытию);
 * заданы — сжатая подпись и «сегодня до …». Правка — в модальном окне.
 */
export function WorkingHoursCard({ business }: { business: Business }) {
  const [open, setOpen] = useState(false);
  const hours = business.workingHours;
  const closing = closingTimeAt(hours, business.timezone, Date.now());

  return (
    <>
      <section className="card" data-testid="working-hours-card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: hours ? undefined : "var(--color-warning-soft)" }}>
        <Clock size={20} aria-hidden="true" style={{ color: hours ? "var(--color-primary)" : "var(--color-warning)", flex: "none" }} />
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          {hours ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 700 }}>Часы работы: <span data-testid="working-hours-summary" style={{ fontWeight: 600 }}>{describeWorkingHours(hours)}</span></p>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}>
                {closing ? `Сейчас открыто — сегодня самовывоз можно назначать до ${clock(closing, business.timezone)}.` : "Сейчас закрыто — новое предложение можно назначить на время работы."} Каждый оффер заканчивается не позже закрытия.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, fontWeight: 700 }}>Укажите часы работы</p>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}>Тогда любое предложение будет автоматически заканчиваться до закрытия, а покупатель не приедет к закрытой двери.</p>
            </>
          )}
        </div>
        <button className={hours ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"} onClick={() => setOpen(true)}>
          {hours ? "Изменить" : "Указать часы работы"}
        </button>
      </section>
      {open ? <WorkingHoursModal initial={hours} timeZone={business.timezone} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
