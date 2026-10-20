import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import "../../i18n";
import { MapOfferCard } from "./MapOfferCard";
import { isKeyboardFocus } from "../../utils/focus";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { makeNearbyOffer } from "../../test/fixtures";

const offer = makeNearbyOffer("pizza", { title: "Пицца Маргарита", businessName: "Pizza Point", discountedPrice: 29000, discountPercent: 55, minutesLeft: 45 });

function setup(selected: boolean) {
  const onSelect = jest.fn();
  const onOpen = jest.fn();
  const view = render(
    <ThemeProvider>
      <MapOfferCard offer={offer} width={300} selected={selected} onSelect={onSelect} onOpen={onOpen} />
    </ThemeProvider>
  );
  return { view, onSelect, onOpen, card: view.getByRole("button") };
}

describe("MapOfferCard", () => {
  it("shows what the card is about at a glance: title, venue with distance, price", () => {
    const { view } = setup(false);
    expect(view.getByText("Пицца Маргарита")).toBeTruthy();
    expect(view.getByText(/Pizza Point · 1\.2/)).toBeTruthy();
    expect(view.getByText("290 ₽")).toBeTruthy();
  });

  it("a tap on a neighbouring card only selects it — an offer is never opened by accident", () => {
    const { card, onSelect, onOpen } = setup(false);
    fireEvent.press(card);
    expect(onSelect).toHaveBeenCalledWith("pizza");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("a tap on the selected card opens the offer", () => {
    const { card, onSelect, onOpen } = setup(true);
    fireEvent.press(card);
    expect(onOpen).toHaveBeenCalledWith("pizza");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keyboard / screen-reader focus on a card shows it on the map without pressing", () => {
    const { card, onSelect, onOpen } = setup(false);
    fireEvent(card, "focus");
    expect(onSelect).toHaveBeenCalledWith("pizza");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("focus that comes from a pointer is not a selection by itself: on web a tap focuses the button before the click", () => {
    const { card, onSelect, onOpen } = setup(false);
    const pointerFocus = { nativeEvent: { target: { matches: (selector: string) => selector !== ":focus-visible" } } };
    fireEvent(card, "focus", pointerFocus);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.press(card);
    expect(onSelect).toHaveBeenCalledWith("pizza");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not re-select the card that is already selected on focus", () => {
    const { card, onSelect } = setup(true);
    fireEvent(card, "focus");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("tells assistive tech everything in one label and what a press will do", () => {
    const calm = setup(false).card.props.accessibilityLabel as string;
    expect(calm).toContain("Пицца Маргарита");
    expect(calm).toContain("Pizza Point");
    expect(calm).toContain("290 ₽");
    expect(calm).toContain("55%");
    expect(calm).toMatch(/Показать на карте$/);

    const selected = setup(true);
    expect(selected.card.props.accessibilityLabel).toMatch(/Открыть предложение$/);
    expect(selected.card.props.accessibilityState).toMatchObject({ selected: true });
  });
});

describe("isKeyboardFocus", () => {
  it("treats focus without a DOM target (native, screen reader) as keyboard focus", () => {
    expect(isKeyboardFocus({})).toBe(true);
    expect(isKeyboardFocus({ nativeEvent: { target: 7 } })).toBe(true);
  });

  it("asks the browser on web", () => {
    expect(isKeyboardFocus({ nativeEvent: { target: { matches: () => true } } })).toBe(true);
    expect(isKeyboardFocus({ nativeEvent: { target: { matches: () => false } } })).toBe(false);
  });

  it("does not break on a browser without :focus-visible", () => {
    expect(isKeyboardFocus({ target: { matches: () => { throw new SyntaxError("bad selector"); } } })).toBe(true);
  });
});
