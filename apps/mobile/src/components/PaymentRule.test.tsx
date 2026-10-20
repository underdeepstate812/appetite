import React from "react";
import { render } from "@testing-library/react-native";
import i18n from "../i18n";
import { PaymentRule } from "./PaymentRule";
import { ThemeProvider } from "../theme/ThemeProvider";

const at = (day: number, h: number) => new Date(2026, 9, day, h, 0).toISOString();
const renderRule = (end: string) =>
  render(
    <ThemeProvider>
      <PaymentRule pickupStart={at(4, 17)} pickupEnd={end} />
    </ThemeProvider>
  );

afterEach(() => i18n.changeLanguage("ru"));

describe("PaymentRule (above the Pay button)", () => {
  it("says the payment is final and gives the deadline", () => {
    const view = renderRule(at(4, 19));
    expect(view.getByText("Оплата окончательная")).toBeTruthy();
    expect(view.getByText("После оплаты заказ отменить нельзя. Заберите до 19:00 — потом заказ сгорает.")).toBeTruthy();
  });

  it("names tomorrow for the 24h deal of the day", () => {
    const view = renderRule(at(5, 18));
    expect(view.getByText(/Заберите до завтра 18:00/)).toBeTruthy();
  });

  it("does not promise or deny a refund: that is a product decision, not a UI fact", () => {
    const view = renderRule(at(4, 19));
    expect(view.queryByText(/возврат|вернут|возвращ/i)).toBeNull();
  });

  it("speaks English too", async () => {
    await i18n.changeLanguage("en");
    const view = renderRule(at(4, 19));
    expect(view.getByText("Payment is final")).toBeTruthy();
    expect(view.getByText(/can't be cancelled after payment/)).toBeTruthy();
  });
});
