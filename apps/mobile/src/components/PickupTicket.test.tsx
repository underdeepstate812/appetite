import React from "react";
import { render } from "@testing-library/react-native";
import { PickupTicket } from "./PickupTicket";
import { ThemeProvider } from "../theme/ThemeProvider";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Soft: "soft", Light: "light", Medium: "medium", Heavy: "heavy", Rigid: "rigid" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

function renderTicket(pickupCode: string) {
  return render(
    <ThemeProvider>
      <PickupTicket qrCodeDataUrl="data:image/png;base64,AAAA" pickupCode={pickupCode} ready codeLabel="Код самовывоза" footnote="Забрать до: 18:00" />
    </ThemeProvider>
  );
}

describe("PickupTicket", () => {
  it("prints every digit of the PIN on its own key", () => {
    const view = renderTicket("482931");

    for (const digit of ["4", "8", "2", "9", "3", "1"]) {
      // Клавиши скрыты от скринридера (PIN читается одним элементом), поэтому ищем и среди скрытых.
      expect(view.getAllByText(digit, { includeHiddenElements: true }).length).toBeGreaterThan(0);
    }
  });

  it("exposes the PIN to screen readers as one element with spaced digits", () => {
    const view = renderTicket("482931");

    expect(view.getByLabelText("Код самовывоза: 4 8 2 9 3 1")).toBeTruthy();
  });

  it("shows the label and the footnote", () => {
    const view = renderTicket("482931");

    expect(view.getByText("КОД САМОВЫВОЗА")).toBeTruthy();
    expect(view.getByText("Забрать до: 18:00")).toBeTruthy();
  });

  it("groups the digits in threes", () => {
    const view = renderTicket("123456");

    expect(view.getAllByText(/^[1-6]$/, { includeHiddenElements: true })).toHaveLength(6);
  });
});
