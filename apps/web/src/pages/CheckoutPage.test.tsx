import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { CheckoutPage } from "./CheckoutPage";

const offer = {
  id: "o1", businessId: "b1", title: "Набор десертов", category: "BAKERY", originalPrice: 60000, discountedPrice: 36000,
  discountPercent: 40, baseDiscountPercent: 25, quantityTotal: 5, quantityLeft: 5, weightKg: 1, status: "ACTIVE",
  pickupStart: new Date(Date.now() - 3600_000).toISOString(), pickupEnd: new Date(Date.now() + 3600_000).toISOString(),
};

const create = vi.fn();
const list = vi.fn();
vi.mock("../api/offers", () => ({ offersApi: { get: vi.fn(async () => offer) } }));
vi.mock("../api/businesses", () => ({ businessesApi: { get: vi.fn(async () => ({ name: "Кафе", address: "Невский, 1" })) } }));
vi.mock("../api/orders", () => ({ ordersApi: { create: (...a: unknown[]) => create(...a), list: () => list() } }));

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={["/checkout/o1"]}>
      <Routes>
        <Route path="/checkout/:offerId" element={<CheckoutPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CheckoutPage", () => {
  beforeEach(() => {
    create.mockReset();
    list.mockReset();
    localStorage.clear();
  });

  it("shows the real total and creates exactly one order, then goes to the ticket", async () => {
    create.mockResolvedValue({ id: "ord-1" });
    renderCheckout();
    const pay = await screen.findByRole("button", { name: /Оплатить 360/ });
    await userEvent.click(pay);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/orders/ord-1"), { timeout: 5000 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ offerId: "o1", quantity: 1 });
  });

  it("after a lost response it finds the already-created order instead of charging twice", async () => {
    create.mockRejectedValue(new ApiError(0, "Нет соединения"));
    list.mockResolvedValue([{ id: "ord-9", offerId: "o1", createdAt: new Date().toISOString() }]);
    renderCheckout();
    await userEvent.click(await screen.findByRole("button", { name: /Оплатить/ }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/orders/ord-9"), { timeout: 5000 });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("when the outcome cannot be verified it warns instead of inviting a blind retry", async () => {
    create.mockRejectedValue(new ApiError(0, "Нет соединения"));
    list.mockRejectedValue(new ApiError(0, "Нет соединения"));
    renderCheckout();
    await userEvent.click(await screen.findByRole("button", { name: /Оплатить/ }));
    expect(await screen.findByText(/проверьте раздел «Мои заказы»/, {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it("shows the server error and lets the user try again", async () => {
    create.mockRejectedValue(new ApiError(409, "Предложение закончилось"));
    renderCheckout();
    await userEvent.click(await screen.findByRole("button", { name: /Оплатить/ }));
    expect(await screen.findByText("Предложение закончилось", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Оплатить/ })).toBeEnabled();
  });
});
