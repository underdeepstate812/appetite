import { useState } from "react";
import { BadgeCheck, HandHelping } from "lucide-react";
import { ReceiptDisputeReason, type Order } from "@apetite/shared";
import { ApiError } from "../api/client";
import { ordersApi } from "../api/orders";

const REASON_LABEL: Record<ReceiptDisputeReason, string> = {
  [ReceiptDisputeReason.NOT_RECEIVED]: "Заказ не выдали",
  [ReceiptDisputeReason.WRONG_ITEM]: "Выдали не то",
  [ReceiptDisputeReason.QUALITY]: "Проблема с качеством",
  [ReceiptDisputeReason.OTHER]: "Другое",
};

interface ReceiptPanelProps {
  order: Order;
  /** Сервер принял ответ — страница подставляет обновлённый заказ. */
  onUpdated: (order: Order) => void;
}

/**
 * Подтверждение получения со стороны покупателя: заведение отметило выдачу кодом — теперь отвечает и покупатель
 * («получил» или спор). Так выдачу нельзя «закрыть» за его спиной, а у платформы есть основания помочь, если заказ не передан.
 */
export function ReceiptPanel({ order, onUpdated }: ReceiptPanelProps) {
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState<ReceiptDisputeReason>(ReceiptDisputeReason.NOT_RECEIVED);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (order.status !== "COMPLETED") return null;

  const send = async (received: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const body = received ? { received: true } : { received: false, reason, ...(note.trim() ? { note: note.trim() } : {}) };
      onUpdated(await ordersApi.confirmReceipt(order.id, body));
    } catch (sendError) {
      setError(sendError instanceof ApiError && sendError.statusCode !== 0 ? sendError.message : "Не удалось отправить. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  if (order.receiptConfirmedAt) {
    return (
      <section className="card receipt-panel is-done" aria-label="Получение заказа">
        <BadgeCheck size={22} aria-hidden="true" />
        <div>
          <h2>Получение подтверждено</h2>
          <p>Спасибо! Приятного аппетита.</p>
        </div>
      </section>
    );
  }
  if (order.receiptDisputedAt) {
    return (
      <section className="card receipt-panel is-disputed" aria-label="Получение заказа">
        <HandHelping size={22} aria-hidden="true" />
        <div>
          <h2>Обращение отправлено</h2>
          <p>Мы получили ваше сообщение и разберёмся. Дополнить его можно письмом на hello@apetite.ru.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card receipt-panel" aria-label="Получение заказа">
      <h2>Вы получили заказ?</h2>
      <p>Заведение отметило, что выдало заказ. Ваш ответ защищает вас: если заказ не передан, мы разберёмся.</p>

      {disputing ? (
        <form
          className="receipt-form"
          onSubmit={(event) => {
            event.preventDefault();
            void send(false);
          }}
        >
          <fieldset>
            <legend>Что пошло не так?</legend>
            {Object.values(ReceiptDisputeReason).map((value) => (
              <label key={value} className={`receipt-reason${reason === value ? " is-selected" : ""}`}>
                <input type="radio" name="receipt-reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
                {REASON_LABEL[value]}
              </label>
            ))}
          </fieldset>
          <label className="receipt-note">
            Пояснение (необязательно)
            <textarea value={note} maxLength={500} rows={2} onChange={(event) => setNote(event.target.value)} />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="receipt-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Отправляем…" : "Отправить"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setDisputing(false)}>
              Назад
            </button>
          </div>
        </form>
      ) : (
        <>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="receipt-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void send(true)}>
              Да, получил
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setDisputing(true)}>
              Нет, не получил
            </button>
          </div>
        </>
      )}
    </section>
  );
}
