import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import "../../i18n";
import { MapOfferRail } from "./MapOfferRail";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { railMetrics } from "../../utils/mapRail";
import { makeNearbyOffer } from "../../test/fixtures";

const offers = ["a", "b", "c", "d"].map((id, index) => makeNearbyOffer(id, { title: `Блюдо ${id}`, distanceKm: 0.5 + index }));
/** Ширина окна в jest-окружении RN — по ней лента считает шаг прилипания. */
const SNAP = railMetrics(require("react-native").Dimensions.get("window").width).snap;

function setup(selectedId: string | null = "a") {
  const onSelect = jest.fn();
  const onOpen = jest.fn();
  const view = render(
    <ThemeProvider>
      <MapOfferRail offers={offers} selectedId={selectedId} onSelect={onSelect} onOpen={onOpen} />
    </ThemeProvider>
  );
  return { view, onSelect, onOpen, list: view.getByLabelText("Предложения на карте") };
}

/** Прокрутка ленты: событие доставляем хост-компоненту — у обёртки onScroll это Animated-событие, а не функция. */
type Instance = ReturnType<ReturnType<typeof render>["getByLabelText"]>;
const scrollTo = (list: Instance, x: number) => {
  const [scroller] = list.findAll((node: Instance) => (node.type as unknown) === "RCTScrollView");
  fireEvent.scroll(scroller, { nativeEvent: { contentOffset: { x }, contentSize: { width: 2000, height: 100 }, layoutMeasurement: { width: 400, height: 100 } } });
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("MapOfferRail", () => {
  it("is a labelled group with a card per offer, nearest first as given", () => {
    const { view, list } = setup();
    expect(list.props.role).toBe("group");
    expect(view.getByText("Блюдо a")).toBeTruthy();
    expect(view.getByText("Блюдо b")).toBeTruthy();
  });

  it("marks exactly the selected card as current", () => {
    const { view } = setup("b");
    const states = view.getAllByRole("button").map((card) => card.props.accessibilityState?.selected);
    expect(states.slice(0, 2)).toEqual([false, true]);
  });

  it("selects the card the user swiped to — but only after the scroll settles, once", () => {
    const { onSelect, list } = setup("a");
    act(() => {
      scrollTo(list, SNAP * 0.4);
      scrollTo(list, SNAP * 0.9);
      scrollTo(list, SNAP * 2.02);
    });
    expect(onSelect).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(200));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("c");
  });

  it("does not re-select the card that is already selected when the swipe ends on it", () => {
    const { onSelect, list } = setup("b");
    act(() => {
      scrollTo(list, SNAP * 1.05);
      jest.advanceTimersByTime(200);
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("a tap on a neighbour selects it, a tap on the selected card opens it", () => {
    const { view, onSelect, onOpen } = setup("a");
    const [first, second] = view.getAllByRole("button");
    fireEvent.press(second);
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.press(first);
    expect(onOpen).toHaveBeenCalledWith("a");
  });
});
