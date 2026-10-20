import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import "../i18n";
import { OrderRow } from "./OrderRow";
import { ThemeProvider } from "../theme/ThemeProvider";

const ORDER = {
  id: "ord-1", userId: "u1", offerId: "o1", businessId: "b1", quantity: 1, totalPrice: 24000, platformFee: 0,
  status: "CONFIRMED", pickupCode: "482931", createdAt: new Date(2026, 9, 4, 12, 22).toISOString(),
} as never;

const renderRow = (props: Partial<React.ComponentProps<typeof OrderRow>> = {}) => {
  const onPress = jest.fn();
  const view = render(
    <ThemeProvider>
      <OrderRow order={ORDER} title="Набор десертов дня" venue="Кафе Пушкинъ" loading={false} onPress={onPress} {...props} />
    </ThemeProvider>
  );
  return { view, onPress };
};

describe("OrderRow", () => {
  it("names what was ordered and where, not just the amount", () => {
    const { view } = renderRow();
    expect(view.getByText("Набор десертов дня")).toBeTruthy();
    expect(view.getByText("Кафе Пушкинъ")).toBeTruthy();
    expect(view.getByText("240 ₽")).toBeTruthy();
    expect(view.getByText("Ожидает самовывоза")).toBeTruthy();
  });

  it("gives screen readers one meaningful sentence per row", () => {
    const { view } = renderRow();
    const row = view.getByRole("button");
    expect(row.props.accessibilityLabel).toMatch(/^Набор десертов дня, Кафе Пушкинъ, 240 ₽, Ожидает самовывоза, /);
  });

  it("opens the order by id", () => {
    const { view, onPress } = renderRow();
    fireEvent.press(view.getByRole("button"));
    expect(onPress).toHaveBeenCalledWith("ord-1");
  });

  it("shows quantity only when it is more than one", () => {
    expect(renderRow().view.queryByText(/x\d/)).toBeNull();
    const many = renderRow({ order: { ...(ORDER as object), quantity: 3 } as never });
    expect(many.view.getByText(/x3/)).toBeTruthy();
  });

  it("while labels load, holds the place with a skeleton instead of a wrong title", () => {
    const { view } = renderRow({ title: undefined, venue: undefined, loading: true });
    expect(view.queryByText("Заказ")).toBeNull();
    expect(view.queryByText("Набор десертов дня")).toBeNull();
    expect(view.getByText("240 ₽")).toBeTruthy();
  });

  it("falls back to a plain 'Заказ' when the title could not be loaded", () => {
    const { view } = renderRow({ title: undefined, venue: undefined, loading: false });
    expect(view.getByText("Заказ")).toBeTruthy();
    expect(view.queryByText("Кафе Пушкинъ")).toBeNull();
  });

  it("reminds to confirm receipt on a handed-over order the buyer has not answered", () => {
    const { view } = renderRow({ order: { ...(ORDER as object), status: "COMPLETED", receiptConfirmedAt: null, receiptDisputedAt: null } as never });
    expect(view.getByText("Подтвердите получение")).toBeTruthy();
    expect(view.getByRole("button").props.accessibilityLabel).toContain("Подтвердите получение");
  });

  it("stops reminding once the buyer answered either way", () => {
    expect(renderRow({ order: { ...(ORDER as object), status: "COMPLETED", receiptConfirmedAt: "2026-10-05T10:00:00Z" } as never }).view.queryByText("Подтвердите получение")).toBeNull();
    expect(renderRow({ order: { ...(ORDER as object), status: "COMPLETED", receiptDisputedAt: "2026-10-05T10:00:00Z" } as never }).view.queryByText("Подтвердите получение")).toBeNull();
  });

  it("does not remind about orders that are not handed over yet", () => {
    expect(renderRow().view.queryByText("Подтвердите получение")).toBeNull();
  });
});

