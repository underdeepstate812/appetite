import React from "react";
import { CardIcon, FastPaymentIcon } from "./icons/PaymentIcons";
import { RadioCards } from "./kit/RadioCards";

export type PaymentMethod = "card" | "sbp";

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  cardLabel: string;
  sbpLabel: string;
  cardHint: string;
  sbpHint: string;
  /** Имя группы для скринридера («Способ оплаты»): видимая подпись лежит снаружи компонента. */
  groupLabel?: string;
}

/**
 * Оплата в бете всегда mock (backend PaymentProvider) — выбор способа не меняет
 * поведение сервера, но делает экран оформления честным и привычным: пользователь
 * видит реальный выбор (карта/СБП), а не один безальтернативный "Оплатить".
 * Сама механика выбора — RadioCards (скользящая стеклянная плашка, отметка-пружина).
 */
export function PaymentMethodSelector({ value, onChange, cardLabel, sbpLabel, cardHint, sbpHint, groupLabel }: PaymentMethodSelectorProps) {
  return (
    <RadioCards
      groupLabel={groupLabel}
      value={value}
      onChange={onChange}
      options={[
        { value: "card", label: cardLabel, hint: cardHint, icon: (color) => <CardIcon size={20} color={color} /> },
        { value: "sbp", label: sbpLabel, hint: sbpHint, icon: (color) => <FastPaymentIcon size={20} color={color} /> },
      ]}
    />
  );
}
