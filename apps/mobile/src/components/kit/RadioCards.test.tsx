import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { RadioCards } from "./RadioCards";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { playHaptic } from "../../utils/haptics";

jest.mock("../../utils/haptics", () => ({ playHaptic: jest.fn() }));

const OPTIONS = [
  { value: "card", label: "Банковская карта", hint: "Visa, Mastercard, МИР" },
  { value: "sbp", label: "СБП", hint: "Оплата по QR через банк" },
  { value: "cash", label: "Наличные" },
];
const layoutOf = (y: number, height = 60) => ({ nativeEvent: { layout: { x: 0, y, width: 300, height } } });

const tree = (value: string, onChange = jest.fn()) => (
  <ThemeProvider>
    <RadioCards groupLabel="Способ оплаты" options={OPTIONS} value={value} onChange={onChange} />
  </ThemeProvider>
);
function measure(view: ReturnType<typeof render>) {
  fireEvent(view.getByLabelText(/^Банковская карта/), "layout", layoutOf(0));
  fireEvent(view.getByLabelText(/^СБП/), "layout", layoutOf(70));
  fireEvent(view.getByLabelText(/^Наличные/), "layout", layoutOf(140, 44));
}
// В тесте стиль хранит сами Animated.Value, а не числа: читаем их текущее значение.
const num = (v: unknown): number => (typeof v === "number" ? v : (v as { __getValue: () => number }).__getValue());
const paneStyle = (view: ReturnType<typeof render>) => {
  const group = view.getByLabelText("Способ оплаты");
  const pane = group.children[group.children.length - 1] as unknown as { props: { style: unknown } };
  const style = StyleSheet.flatten(pane.props.style as never) as { top: unknown; height: unknown };
  return { top: num(style.top), height: num(style.height) };
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe("RadioCards", () => {
  it("is a named radio group; each card says what it is and which one is selected", () => {
    const view = render(tree("sbp"));
    expect(view.getByLabelText("Способ оплаты").props.accessibilityRole).toBe("radiogroup");
    expect(view.getAllByRole("radio")).toHaveLength(3);
    expect(view.getByRole("radio", { name: "СБП. Оплата по QR через банк" }).props.accessibilityState).toMatchObject({ checked: true });
    expect(view.getByRole("radio", { name: "Банковская карта. Visa, Mastercard, МИР" }).props.accessibilityState).toMatchObject({ checked: false });
    expect(view.getByRole("radio", { name: "Наличные" })).toBeTruthy();
  });

  it("does not draw the glass pane until the cards are measured", () => {
    const view = render(tree("card"));
    expect(view.getByLabelText("Способ оплаты").children).toHaveLength(3);
  });

  it("puts the pane on the selected card right after measuring, without travelling there", () => {
    const view = render(tree("sbp"));
    measure(view);
    expect(paneStyle(view)).toMatchObject({ top: 70, height: 60 });
  });

  it("slides the pane to the newly selected card and takes its height", () => {
    const view = render(tree("card"));
    measure(view);
    expect(paneStyle(view)).toMatchObject({ top: 0, height: 60 });
    view.rerender(tree("cash"));
    act(() => void jest.advanceTimersByTime(600));
    expect(paneStyle(view)).toMatchObject({ top: 140, height: 44 });
  });

  it("reports a new choice with a light tick, and ignores a tap on the card that is already selected", () => {
    const onChange = jest.fn();
    const view = render(tree("card", onChange));
    fireEvent.press(view.getByRole("radio", { name: /^СБП/ }));
    expect(onChange).toHaveBeenCalledWith("sbp");
    expect(playHaptic).toHaveBeenCalledWith("select");
    onChange.mockClear();
    (playHaptic as jest.Mock).mockClear();
    fireEvent.press(view.getByRole("radio", { name: /^Банковская карта/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(playHaptic).not.toHaveBeenCalled();
  });

  it("re-snaps to the selected card when its layout changes (text wrapped), instead of travelling", () => {
    const view = render(tree("card"));
    measure(view);
    fireEvent(view.getByLabelText(/^Банковская карта/), "layout", layoutOf(0, 88));
    expect(paneStyle(view)).toMatchObject({ top: 0, height: 88 });
  });
});
