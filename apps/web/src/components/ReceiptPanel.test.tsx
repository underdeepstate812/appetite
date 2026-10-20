import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReceiptPanel } from "./ReceiptPanel";
import { ApiError } from "../api/client";

const confirmReceipt = vi.fn();
vi.mock("../api/orders", () => ({ ordersApi: { confirmReceipt: (...a: unknown[]) => confirmReceipt(...a) } }));

const ORDER = { id: "ord-1", status: "COMPLETED", receiptConfirmedAt: null, receiptDisputedAt: null } as never;

// Фигурные скобки важны: стрелка без них вернула бы сам мок, а vitest вызывает функцию, возвращённую из beforeEach, как очистку —
// мок с отказом тогда вызывался бы после теста и давал «необработанный» reject.
beforeEach(() => {
  confirmReceipt.mockReset();
});

describe("ReceiptPanel", () => {
  it("asks whether the order was received once the venue marked it handed over", () => {
    render(<ReceiptPanel order={ORDER} onUpdated={() => {}} />);
    expect(screen.getByRole("heading", { name: "Вы получили заказ?" })).toBeInTheDocument();
  });

  it("renders nothing before the order is completed", () => {
    const { container } = render(<ReceiptPanel order={{ id: "o", status: "CONFIRMED" } as never} onUpdated={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("'yes' confirms and passes the updated order up", async () => {
    const updated = { ...(ORDER as object), receiptConfirmedAt: "2026-10-05T10:00:00Z" };
    confirmReceipt.mockResolvedValue(updated);
    const onUpdated = vi.fn();
    render(<ReceiptPanel order={ORDER} onUpdated={onUpdated} />);
    await userEvent.click(screen.getByRole("button", { name: "Да, получил" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(confirmReceipt).toHaveBeenCalledWith("ord-1", { received: true });
  });

  it("'no' opens the reasons; sending carries the chosen reason and the trimmed note", async () => {
    confirmReceipt.mockResolvedValue({ ...(ORDER as object), receiptDisputedAt: "x" });
    render(<ReceiptPanel order={ORDER} onUpdated={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Нет, не получил" }));
    expect(screen.getByRole("radio", { name: "Заказ не выдали" })).toBeChecked();
    expect(confirmReceipt).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("radio", { name: "Выдали не то" }));
    await userEvent.type(screen.getByLabelText(/Пояснение/), "  Дали другую пиццу ");
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));
    await waitFor(() => expect(confirmReceipt).toHaveBeenCalledWith("ord-1", { received: false, reason: "WRONG_ITEM", note: "Дали другую пиццу" }));
  });

  it("shows the server's refusal and keeps the form for another try", async () => {
    confirmReceipt.mockRejectedValue(new ApiError(409, "Ты уже ответил по этому заказу"));
    render(<ReceiptPanel order={ORDER} onUpdated={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Нет, не получил" }));
    await userEvent.click(screen.getByRole("button", { name: "Отправить" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ты уже ответил по этому заказу");
    expect(screen.getByRole("button", { name: "Отправить" })).toBeEnabled();
  });

  it("a lost connection gets a plain retry message", async () => {
    confirmReceipt.mockRejectedValue(new ApiError(0, "Нет соединения"));
    render(<ReceiptPanel order={ORDER} onUpdated={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Да, получил" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось отправить. Попробуйте ещё раз.");
  });

  it("after the answer shows a calm summary", () => {
    const a = render(<ReceiptPanel order={{ ...(ORDER as object), receiptConfirmedAt: "x" } as never} onUpdated={() => {}} />);
    expect(screen.getByText("Получение подтверждено")).toBeInTheDocument();
    a.unmount();
    render(<ReceiptPanel order={{ ...(ORDER as object), receiptDisputedAt: "x" } as never} onUpdated={() => {}} />);
    expect(screen.getByText("Обращение отправлено")).toBeInTheDocument();
  });
});
