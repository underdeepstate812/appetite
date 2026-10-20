import React from "react";
import { Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import i18n from "../../i18n";
import { EmptyState, OfflineState } from "./EmptyState";
import { ThemeProvider } from "../../theme/ThemeProvider";

const wrap = (node: React.ReactElement) => render(<ThemeProvider>{node}</ThemeProvider>);
afterEach(() => i18n.changeLanguage("ru"));

describe("EmptyState", () => {
  it("shows the icon, a title, an explanation and one action", () => {
    const onPress = jest.fn();
    const view = wrap(<EmptyState icon={() => <Text>ЗНАЧОК</Text>} title="Заказов пока нет" description="Найдите предложение рядом." action={{ label: "Смотреть предложения", onPress }} />);
    expect(view.getByText("ЗНАЧОК")).toBeTruthy();
    expect(view.getByText("Заказов пока нет")).toBeTruthy();
    expect(view.getByText("Найдите предложение рядом.")).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Смотреть предложения" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("title is a header for screen readers; description and action are optional", () => {
    const view = wrap(<EmptyState icon={() => null} title="Пусто" />);
    expect(view.getByRole("header", { name: "Пусто" })).toBeTruthy();
    expect(view.queryByRole("button")).toBeNull();
  });

  it("hands the icon the accent colour of its tone", () => {
    const colors: string[] = [];
    wrap(<EmptyState icon={(c) => { colors.push(c); return null; }} title="a" tone="mint" />);
    wrap(<EmptyState icon={(c) => { colors.push(c); return null; }} title="b" tone="ember" />);
    expect(colors[0]).not.toBe(colors[1]);
  });
});

describe("OfflineState", () => {
  it("says there is no connection and offers a retry", () => {
    const onRetry = jest.fn();
    const view = wrap(<OfflineState onRetry={onRetry} />);
    expect(view.getByText("Нет соединения")).toBeTruthy();
    expect(view.getByText(/интернета нет/)).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Повторить" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("speaks English", async () => {
    await i18n.changeLanguage("en");
    const view = wrap(<OfflineState onRetry={() => {}} />);
    expect(view.getByText("No connection")).toBeTruthy();
    expect(view.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
