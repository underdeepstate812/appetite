import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../i18n";
import { ReceiptCard } from "./ReceiptCard";
import { ThemeProvider } from "../theme/ThemeProvider";
import { ordersApi } from "../api/orders";
import { ApiError } from "../api/client";

jest.mock("../api/orders", () => ({ ordersApi: { confirmReceipt: jest.fn() } }));
jest.mock("../utils/haptics", () => ({ playHaptic: jest.fn() }));

const confirmReceipt = ordersApi.confirmReceipt as jest.Mock;
const ORDER = { id: "ord-1", status: "COMPLETED", receiptConfirmedAt: null, receiptDisputedAt: null } as never;

function mount(order = ORDER) {
  const onUpdated = jest.fn();
  const view = render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <ReceiptCard order={order} onUpdated={onUpdated} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
  return { view, onUpdated };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe("ReceiptCard", () => {
  it("asks the buyer whether they got the order, once the venue marked it as handed over", () => {
    const { view } = mount();
    expect(view.getByText("Вы получили заказ?")).toBeTruthy();
    expect(view.getByRole("button", { name: "Да, получил" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Нет, не получил" })).toBeTruthy();
  });

  it("shows nothing until the order is completed", () => {
    const { view } = mount({ id: "o", status: "CONFIRMED" } as never);
    expect(view.queryByText("Вы получили заказ?")).toBeNull();
    expect(view.queryByRole("button")).toBeNull();
  });

  it("'yes' confirms receipt and hands the updated order to the screen", async () => {
    const updated = { ...(ORDER as object), receiptConfirmedAt: "2026-10-05T10:00:00Z" };
    confirmReceipt.mockResolvedValue(updated);
    const { view, onUpdated } = mount();
    fireEvent.press(view.getByRole("button", { name: "Да, получил" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(confirmReceipt).toHaveBeenCalledWith("ord-1", { received: true });
  });

  it("'no' opens the reasons first and sends nothing yet", () => {
    const { view } = mount();
    fireEvent.press(view.getByRole("button", { name: "Нет, не получил" }));
    expect(view.getByText("Что пошло не так?")).toBeTruthy();
    expect(view.getByRole("radio", { name: "Заказ не выдали" }).props.accessibilityState).toMatchObject({ checked: true });
    expect(confirmReceipt).not.toHaveBeenCalled();
  });

  it("sends the chosen reason as a dispute", async () => {
    const updated = { ...(ORDER as object), receiptDisputedAt: "2026-10-05T10:00:00Z" };
    confirmReceipt.mockResolvedValue(updated);
    const { view, onUpdated } = mount();
    fireEvent.press(view.getByRole("button", { name: "Нет, не получил" }));
    fireEvent.press(view.getByRole("radio", { name: "Выдали не то" }));
    fireEvent.press(view.getByRole("button", { name: "Отправить" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(confirmReceipt).toHaveBeenCalledWith("ord-1", { received: false, reason: "WRONG_ITEM" });
  });

  it("shows the server's message when it refuses (e.g. already answered) and stays open for another try", async () => {
    confirmReceipt.mockRejectedValue(new ApiError(409, "Ты уже ответил по этому заказу"));
    const { view, onUpdated } = mount();
    fireEvent.press(view.getByRole("button", { name: "Нет, не получил" }));
    fireEvent.press(view.getByRole("button", { name: "Отправить" }));
    await waitFor(() => expect(view.getByRole("alert")).toBeTruthy());
    expect(view.getByText("Ты уже ответил по этому заказу")).toBeTruthy();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("a lost connection gets a plain retry message, not a raw network error", async () => {
    confirmReceipt.mockRejectedValue(new ApiError(0, "Нет соединения с сервером. Проверь интернет"));
    const { view } = mount();
    fireEvent.press(view.getByRole("button", { name: "Да, получил" }));
    await waitFor(() => expect(view.getByText("Не удалось отправить. Попробуйте ещё раз.")).toBeTruthy());
  });

  it("after the answer shows a calm summary instead of the question", () => {
    const confirmed = mount({ ...(ORDER as object), receiptConfirmedAt: "2026-10-05T10:00:00Z" } as never);
    expect(confirmed.view.getByText("Получение подтверждено")).toBeTruthy();
    expect(confirmed.view.queryByText("Вы получили заказ?")).toBeNull();
    const disputed = mount({ ...(ORDER as object), receiptDisputedAt: "2026-10-05T10:00:00Z" } as never);
    expect(disputed.view.getByText("Обращение отправлено")).toBeTruthy();
  });
});
