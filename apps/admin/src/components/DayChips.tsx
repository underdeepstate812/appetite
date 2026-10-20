import { DAY_SHORT } from "../utils/schedule";

const PRESETS: { label: string; days: number[] }[] = [
  { label: "Каждый день", days: [1, 2, 3, 4, 5, 6, 7] },
  { label: "Будни", days: [1, 2, 3, 4, 5] },
  { label: "Выходные", days: [6, 7] },
];

/** Выбор дней недели: кнопки-переключатели Пн…Вс и быстрые наборы («Будни», «Выходные», «Каждый день»). */
export function DayChips({ idPrefix, value, onChange }: { idPrefix: string; value: number[]; onChange: (days: number[]) => void }) {
  const toggle = (day: number) => onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <span id={`${idPrefix}-days-label`} style={{ fontSize: 13, fontWeight: 600 }}>
          Дни недели
        </span>
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(preset.days)}>
            {preset.label}
          </button>
        ))}
      </div>
      <div role="group" aria-labelledby={`${idPrefix}-days-label`} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {DAY_SHORT.map((label, index) => {
          const day = index + 1;
          const on = value.includes(day);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(day)}
              style={{
                minWidth: 44,
                minHeight: 40,
                borderRadius: 10,
                border: `1.5px solid ${on ? "var(--color-primary)" : "var(--color-border)"}`,
                background: on ? "var(--color-primary)" : "var(--color-surface)",
                color: on ? "var(--color-on-primary)" : "var(--color-text)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
