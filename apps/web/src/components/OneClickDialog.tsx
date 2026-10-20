import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { PaymentMethodSelector, type PaymentMethod } from "./PaymentMethodSelector";
import { FoodInfo } from "./FoodInfo";
import type { FoodOffer } from "../utils/foodInfo";
import { formatRub } from "../utils/format";
import { readPaymentMethod } from "../utils/paymentPrefs";

interface Props {
  title: string;
  shop: string;
  priceMinor: number;
  /** Состав и аллергены заказываемого предложения — человек видит их до оплаты. */
  food?: FoodOffer;
  onConfirm: (method: PaymentMethod) => void;
  onCancel: () => void;
}

/**
 * Единоразовое согласие на «заказ в 1 клик». Оплата необратима (после неё заказ не отменить), поэтому
 * первый раз человек видит, что именно и чем будет оплачено; дальше кнопка на карточках работает с одного нажатия.
 * Диалог модальный: фокус внутри, Esc/клик по фону отменяют, фокус возвращается на кнопку, с которой открыли.
 */
export function OneClickDialog({ title, shop, priceMinor, food, onConfirm, onCancel }: Props) {
  const [method, setMethod] = useState<PaymentMethod>(readPaymentMethod);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      // Простая ловушка фокуса: Tab/Shift+Tab ходят по кругу внутри диалога.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)");
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div ref={dialogRef} className="modal card" role="dialog" aria-modal="true" aria-labelledby="oneclick-title">
        <span className="modal-icon" aria-hidden="true">
          <Zap size={22} />
        </span>
        <h2 id="oneclick-title">Включить заказ в 1 клик?</h2>
        <p className="modal-offer">
          «{title}» · {shop}
        </p>
        <ul className="modal-points">
          <li>Заказ оплачивается сразу, выбранным способом — без отдельного экрана оформления.</li>
          <li>
            <strong>После оплаты заказ отменить нельзя.</strong>
          </li>
          <li>Согласие действует, пока вы не выйдете из аккаунта.</li>
        </ul>
        {food ? <FoodInfo offer={food} compact /> : null}
        <PaymentMethodSelector value={method} onChange={setMethod} />
        <p className="modal-fineprint">Бета: оплата в тестовом режиме — деньги не списываются.</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Отмена
          </button>
          <button ref={confirmRef} type="button" className="btn btn-primary" onClick={() => onConfirm(method)}>
            <Zap size={16} aria-hidden="true" /> Заказать за {formatRub(priceMinor)}
          </button>
        </div>
      </div>
    </div>
  );
}
