import { describe, expect, it } from "vitest";
import { OrderStatus } from "@apetite/shared";
import { accountContact, attentionCount, summarizeOrders, summaryCaption } from "./accountSummary";

const order = (status: OrderStatus, extra: Record<string, unknown> = {}) => ({ status, receiptConfirmedAt: null, receiptDisputedAt: null, ...extra }) as never;

describe("accountSummary", () => {
  it("считает ожидающие самовывоза и неподтверждённые получения; отменённые и просроченные — не в счёт", () => {
    const s = summarizeOrders([
      order(OrderStatus.CONFIRMED),
      order(OrderStatus.CONFIRMED),
      order(OrderStatus.COMPLETED),
      order(OrderStatus.COMPLETED, { receiptConfirmedAt: "2026-10-18T10:00:00Z" }),
      order(OrderStatus.COMPLETED, { receiptDisputedAt: "2026-10-18T10:00:00Z" }),
      order(OrderStatus.CANCELLED),
      order(OrderStatus.EXPIRED),
    ]);
    expect(s).toEqual({ pickup: 2, receipt: 1 });
    expect(attentionCount(s)).toBe(3);
  });

  it("подпись: молчит, когда ничего не требуется; склоняет числа", () => {
    expect(summaryCaption({ pickup: 0, receipt: 0 })).toBeNull();
    expect(summaryCaption({ pickup: 1, receipt: 0 })).toBe("1 заказ ждёт самовывоза");
    expect(summaryCaption({ pickup: 3, receipt: 0 })).toBe("3 заказа ждут самовывоза");
    expect(summaryCaption({ pickup: 5, receipt: 0 })).toBe("5 заказов ждут самовывоза");
    expect(summaryCaption({ pickup: 1, receipt: 1 })).toBe("1 заказ ждёт самовывоза · подтвердите получение");
  });

  it("контакт: email, а без него телефон", () => {
    expect(accountContact({ email: "a@b.ru", phone: "+7999" })).toBe("a@b.ru");
    expect(accountContact({ email: "", phone: "+79991234567" })).toBe("+79991234567");
    expect(accountContact({})).toBe("");
  });
});
