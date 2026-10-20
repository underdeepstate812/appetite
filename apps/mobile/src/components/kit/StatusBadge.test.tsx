import React from "react";
import { render } from "@testing-library/react-native";
import { OrderStatus } from "@apetite/shared";
import { StatusBadge } from "./StatusBadge";
import { ThemeProvider } from "../../theme/ThemeProvider";

const LABELS: Record<OrderStatus, string> = {
  [OrderStatus.CONFIRMED]: "Ожидает самовывоза",
  [OrderStatus.COMPLETED]: "Забран",
  [OrderStatus.CANCELLED]: "Отменён",
  [OrderStatus.EXPIRED]: "Просрочен",
};

describe("StatusBadge", () => {
  it.each(Object.values(OrderStatus))("shows the label of %s as real text (not colour alone)", (status) => {
    const view = render(<ThemeProvider><StatusBadge status={status} label={LABELS[status]} /></ThemeProvider>);
    expect(view.getByText(LABELS[status])).toBeTruthy();
  });

  it("keeps long labels on one line so a row never grows", () => {
    const view = render(<ThemeProvider><StatusBadge status={OrderStatus.CONFIRMED} label="Ожидает самовывоза" /></ThemeProvider>);
    expect(view.getByText("Ожидает самовывоза").props.numberOfLines).toBe(1);
  });
});
