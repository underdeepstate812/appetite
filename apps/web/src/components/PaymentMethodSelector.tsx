import { Check, CreditCard, Zap } from "lucide-react";

export type PaymentMethod = "card" | "sbp";

const OPTIONS: { key: PaymentMethod; label: string; hint: string; Icon: typeof CreditCard }[] = [
  { key: "card", label: "Банковская карта", hint: "Visa, Mastercard, МИР", Icon: CreditCard },
  { key: "sbp", label: "СБП", hint: "Оплата по QR через банк", Icon: Zap },
];

interface Props {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
}

/**
 * Оплата в бете всегда mock (backend PaymentProvider): выбор способа не меняет поведение сервера, но делает
 * экран оформления честным и привычным — как в мобильном приложении. Реквизиты карты здесь намеренно НЕ
 * запрашиваются: платёжная форма появится вместе с настоящим провайдером (его страница/виджет).
 */
export function PaymentMethodSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="pay-methods" role="radiogroup" aria-label="Способ оплаты">
      {OPTIONS.map(({ key, label, hint, Icon }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={`pay-method${selected ? " is-selected" : ""}`}
            onClick={() => onChange(key)}
          >
            <span className="pay-method-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="pay-method-text">
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
            <span className="pay-method-radio" aria-hidden="true">
              {selected ? <Check size={13} strokeWidth={3.2} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
