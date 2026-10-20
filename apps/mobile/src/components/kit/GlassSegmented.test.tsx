import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { GlassSegmented } from "./GlassSegmented";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { playHaptic } from "../../utils/haptics";

jest.mock("../../utils/haptics", () => ({ playHaptic: jest.fn() }));

const OPTIONS = [
  { value: "now", label: "Сейчас" },
  { value: "evening", label: "Вечерние" },
  { value: "all", label: "Все" },
];
const layoutOf = (x: number, width = 100) => ({ nativeEvent: { layout: { x, y: 0, width, height: 44 } } });

const tree = (value: string, onChange = jest.fn()) => (
  <ThemeProvider>
    <GlassSegmented accessibilityLabel="Время самовывоза" options={OPTIONS} value={value} onChange={onChange} />
  </ThemeProvider>
);
function measure(view: ReturnType<typeof render>) {
  fireEvent(view.getByRole("radio", { name: "Сейчас" }), "layout", layoutOf(4));
  fireEvent(view.getByRole("radio", { name: "Вечерние" }), "layout", layoutOf(104, 110));
  fireEvent(view.getByRole("radio", { name: "Все" }), "layout", layoutOf(214));
}
// В тесте стиль хранит сами Animated.Value, а не числа: читаем их текущее значение.
const num = (v: unknown): number => (typeof v === "number" ? v : (v as { __getValue: () => number }).__getValue());
const thumb = (view: ReturnType<typeof render>) => {
  const group = view.getByLabelText("Время самовывоза");
  const style = StyleSheet.flatten((group.children[0] as unknown as { props: { style: unknown } }).props.style as never) as { left: unknown; width: unknown };
  return { left: num(style.left), width: num(style.width) };
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe("GlassSegmented", () => {
  it("is a radio group of labelled segments with the selected one marked", () => {
    const view = render(tree("evening"));
    expect(view.getByLabelText("Время самовывоза").props.accessibilityRole).toBe("radiogroup");
    expect(view.getAllByRole("radio")).toHaveLength(3);
    expect(view.getByRole("radio", { name: "Вечерние" }).props.accessibilityState).toMatchObject({ checked: true });
    expect(view.getByRole("radio", { name: "Сейчас" }).props.accessibilityState).toMatchObject({ checked: false });
  });

  it("places the glass thumb under the selected segment and moves it to the next one", () => {
    const view = render(tree("now"));
    measure(view);
    expect(thumb(view)).toMatchObject({ left: 4, width: 100 });
    view.rerender(tree("evening"));
    act(() => void jest.advanceTimersByTime(600));
    expect(thumb(view)).toMatchObject({ left: 104, width: 110 });
  });

  it("reports a change once with a haptic tick; the selected segment does nothing", () => {
    const onChange = jest.fn();
    const view = render(tree("now", onChange));
    fireEvent.press(view.getByRole("radio", { name: "Все" }));
    expect(onChange).toHaveBeenCalledWith("all");
    expect(playHaptic).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByRole("radio", { name: "Сейчас" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  describe("icon-only (theme switch)", () => {
    const ICON_OPTIONS = [
      { value: "light", label: "Светлая", icon: (c: string) => <Text>{`SUN:${c}`}</Text> },
      { value: "dark", label: "Тёмная", icon: (c: string) => <Text>{`MOON:${c}`}</Text> },
    ];
    const iconTree = (value: string, onChange = jest.fn()) => (
      <ThemeProvider>
        <GlassSegmented compact accessibilityLabel="Тема оформления" options={ICON_OPTIONS} value={value} onChange={onChange} />
      </ThemeProvider>
    );

    it("shows icons instead of text, but keeps the names for screen readers", () => {
      const view = render(iconTree("light"));
      expect(view.getByText(/^SUN:/)).toBeTruthy();
      expect(view.getByText(/^MOON:/)).toBeTruthy();
      expect(view.queryByText("Светлая")).toBeNull();
      expect(view.queryByText("Тёмная")).toBeNull();
      expect(view.getByRole("radio", { name: "Светлая" }).props.accessibilityState).toMatchObject({ checked: true });
      expect(view.getByRole("radio", { name: "Тёмная" }).props.accessibilityState).toMatchObject({ checked: false });
    });

    it("gives the active icon a different colour from the inactive one", () => {
      const view = render(iconTree("light"));
      const sun = (view.getByText(/^SUN:/).props.children as string).split(":")[1];
      const moon = (view.getByText(/^MOON:/).props.children as string).split(":")[1];
      expect(sun).not.toBe(moon);
    });

    it("switches on tap", () => {
      const onChange = jest.fn();
      const view = render(iconTree("light", onChange));
      fireEvent.press(view.getByRole("radio", { name: "Тёмная" }));
      expect(onChange).toHaveBeenCalledWith("dark");
    });
  });
});
