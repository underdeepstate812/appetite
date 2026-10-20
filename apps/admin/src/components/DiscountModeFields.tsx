import { DISCOUNT_RULES, DiscountMode, discountSteps } from "@apetite/shared";

interface DiscountModeFieldsProps {
  idPrefix: string;
  mode: DiscountMode;
  onChange: (mode: DiscountMode) => void;
  /** Скидка из поля «стартовая/фиксированная» — по ней строим подсказку со ступенями. */
  baseDiscountPercent: number;
}

/**
 * Как меняется скидка: «растёт к концу самовывоза» (стартовая + 10% за 2 часа, + 20% за час, максимум 70%) или
 * «фиксированная» (всё время одна и та же). Под выбором — живая подсказка со ступенями, чтобы владелец видел, что именно
 * увидит покупатель. Если расти некуда (стартовая уже ≥ 70%), подсказываем про фиксированную.
 */
export function DiscountModeFields({ idPrefix, mode, onChange, baseDiscountPercent }: DiscountModeFieldsProps) {
  const base = Number.isFinite(baseDiscountPercent) ? baseDiscountPercent : DISCOUNT_RULES.DEFAULT_BASE_PERCENT;
  const dynamicSteps = discountSteps(DiscountMode.DYNAMIC, base);
  const nothingToGrow = base >= DISCOUNT_RULES.MAX_PERCENT;
  const options: { value: DiscountMode; title: string; hint: string }[] = [
    { value: DiscountMode.DYNAMIC, title: "Растёт к концу самовывоза", hint: "Чем ближе конец, тем выше скидка — больше шансов продать остатки" },
    { value: DiscountMode.FIXED, title: "Фиксированная", hint: "Скидка не меняется: цена одна на всё время самовывоза" },
  ];

  return (
    <fieldset style={{ border: "none", margin: 0, padding: 0, minInlineSize: 0 }}>
      <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, padding: 0 }}>Скидка со временем</legend>
      <div role="radiogroup" aria-label="Как меняется скидка" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
        {options.map((option) => {
          const selected = mode === option.value;
          return (
            <label
              key={option.value}
              htmlFor={`${idPrefix}-mode-${option.value}`}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "10px 12px",
                borderRadius: 12,
                border: `1.5px solid ${selected ? "var(--color-primary)" : "var(--color-border)"}`,
                background: selected ? "var(--color-primary-soft)" : "var(--color-surface)",
                cursor: "pointer",
              }}
            >
              <input
                id={`${idPrefix}-mode-${option.value}`}
                type="radio"
                name={`${idPrefix}-discount-mode`}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                style={{ width: 16, height: 16, margin: "3px 0 0", padding: 0, flexShrink: 0, accentColor: "var(--color-primary)" }}
              />
              <span>
                <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{option.title}</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 2 }}>{option.hint}</span>
              </span>
            </label>
          );
        })}
      </div>

      <p className="field-hint" style={{ marginTop: 8 }} aria-live="polite">
        {mode === DiscountMode.FIXED ? (
          <>
            Всё время самовывоза: <strong>−{base}%</strong>.
          </>
        ) : nothingToGrow ? (
          <>
            Стартовая скидка уже {DISCOUNT_RULES.MAX_PERCENT}% — расти некуда, это то же самое, что фиксированная.
          </>
        ) : (
          <>
            Покупатель увидит:{" "}
            {dynamicSteps.map((step, index) => (
              <span key={step.percent}>
                {index > 0 ? " → " : ""}
                <strong>−{step.percent}%</strong>
                {index === 0 ? " сначала" : step.hoursBeforeEnd === 1 ? " за час до конца" : ` за ${step.hoursBeforeEnd} ч до конца`}
              </span>
            ))}
            .
          </>
        )}
      </p>
    </fieldset>
  );
}
