import { OrderStatus, type Order } from "@apetite/shared";

/** Что в личном кабинете требует внимания: заказ ждёт самовывоза или покупателя просят подтвердить получение. */
export interface AccountSummary {
  /** Оплачено, ещё не забрано. */
  pickup: number;
  /** Заведение выдало, а покупатель не ответил «получил» или «проблема». */
  receipt: number;
}

export const EMPTY_SUMMARY: AccountSummary = { pickup: 0, receipt: 0 };

export function summarizeOrders(orders: Pick<Order, "status" | "receiptConfirmedAt" | "receiptDisputedAt">[]): AccountSummary {
  let pickup = 0;
  let receipt = 0;
  for (const order of orders) {
    if (order.status === OrderStatus.CONFIRMED) pickup += 1;
    else if (order.status === OrderStatus.COMPLETED && !order.receiptConfirmedAt && !order.receiptDisputedAt) receipt += 1;
  }
  return { pickup, receipt };
}

export const attentionCount = (summary: AccountSummary) => summary.pickup + summary.receipt;

/** Подпись под «Мои заказы»: коротко и по делу; null — внимания ничего не требуется. */
export function summaryCaption(summary: AccountSummary): string | null {
  const parts: string[] = [];
  if (summary.pickup > 0) parts.push(summary.pickup === 1 ? "1 заказ ждёт самовывоза" : `${summary.pickup} ${summary.pickup < 5 ? "заказа ждут" : "заказов ждут"} самовывоза`);
  if (summary.receipt > 0) parts.push(summary.receipt === 1 ? "подтвердите получение" : `подтвердите получение (${summary.receipt})`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Что показать под именем: email, а если его нет — телефон. */
export function accountContact(user: { email?: string | null; phone?: string | null }): string {
  return user.email || user.phone || "";
}
