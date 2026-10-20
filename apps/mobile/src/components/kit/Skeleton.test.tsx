import React from "react";
import { render } from "@testing-library/react-native";
import { OrdersListSkeleton } from "./Skeleton";
import { ThemeProvider } from "../../theme/ThemeProvider";

describe("OrdersListSkeleton", () => {
  it("announces itself once as a busy progress indicator, not as a pile of empty boxes", () => {
    const view = render(<ThemeProvider><OrdersListSkeleton label="Загрузка..." /></ThemeProvider>);
    const bar = view.getByRole("progressbar", { name: "Загрузка..." });
    expect(bar.props.accessibilityState).toMatchObject({ busy: true });
    expect(view.getAllByRole("progressbar")).toHaveLength(1);
  });

  it("draws the requested number of rows", () => {
    const three = render(<ThemeProvider><OrdersListSkeleton count={3} label="x" /></ThemeProvider>);
    const five = render(<ThemeProvider><OrdersListSkeleton count={5} label="x" /></ThemeProvider>);
    const rows = (view: ReturnType<typeof render>) => view.getByRole("progressbar").children.length;
    expect(rows(three)).toBe(3);
    expect(rows(five)).toBe(5);
  });
});
