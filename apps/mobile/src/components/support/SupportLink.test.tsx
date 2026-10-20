import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../../i18n";
import { SupportLink } from "./SupportLink";
import { ThemeProvider } from "../../theme/ThemeProvider";

const ORDER = { id: "cm1x9k2ab00004hq7z3d5f9a2b", title: "Набор десертов дня", totalPrice: 24000, createdAt: new Date().toISOString() };
const mount = (order?: typeof ORDER) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <SupportLink order={order} />
      </ThemeProvider>
    </SafeAreaProvider>
  );

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("SupportLink", () => {
  it("on an order screen, offers help with that order, and the sheet opens on tap", () => {
    const view = mount(ORDER);
    expect(view.queryByText("Нужна помощь?")).toBeNull();
    fireEvent.press(view.getByRole("button", { name: /Нужна помощь с заказом/ }));
    expect(view.getByText("Нужна помощь?")).toBeTruthy();
    expect(view.getByText(/Заказ №5F9A2B/)).toBeTruthy();
  });

  it("in the profile, offers general help", () => {
    const view = mount();
    fireEvent.press(view.getByRole("button", { name: /Помощь и поддержка/ }));
    expect(view.getByText("Выберите тему — мы подставим её в письмо")).toBeTruthy();
  });

  it("tells screen readers what help is for, not just that it exists", () => {
    const view = mount(ORDER);
    expect(view.getByRole("button", { name: /Не получается забрать/ })).toBeTruthy();
  });
});
