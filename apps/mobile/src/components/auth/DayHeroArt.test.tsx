import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { DayHeroArt } from "./DayHeroArt";

const hero = (view: ReturnType<typeof render>) => view.getByTestId("day-hero", { includeHiddenElements: true });
const phase = (view: ReturnType<typeof render>) => hero(view).props.dataSet.dayPhase;
const layout = (view: ReturnType<typeof render>, width = 390, height = 344) =>
  fireEvent(hero(view), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height } } });

describe("DayHeroArt", () => {
  it("shows the sky of the given hour: night, dawn, day, sunset", () => {
    const names = [3, 6.7, 12.5, 20].map((hour) => phase(render(<DayHeroArt hour={hour} />)));
    expect(names).toEqual(["night", "dawn", "day", "sunset"]);
  });

  it("follows the local clock when no hour is forced", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 6, 12, 30));
    const view = render(<DayHeroArt />);
    expect(phase(view)).toBe("day");
    jest.useRealTimers();
  });

  it("is decoration: hidden from assistive tech and from touches", () => {
    const view = render(<DayHeroArt hour={12} />);
    expect(hero(view).props["aria-hidden"]).toBe(true);
    expect(hero(view).props.accessibilityElementsHidden).toBe(true);
    expect(hero(view).props.pointerEvents).toBe("none");
  });

  it("draws nothing until it knows its size, then the whole scene at any hour and heat", () => {
    for (const hour of [3, 12, 20]) {
      for (const heat of [null, 0.1, 0.9]) {
        const view = render(<DayHeroArt hour={hour} heat={heat} />);
        expect(() => layout(view)).not.toThrow();
        expect(() => layout(view, 1280, 344)).not.toThrow();
      }
    }
  });
});
