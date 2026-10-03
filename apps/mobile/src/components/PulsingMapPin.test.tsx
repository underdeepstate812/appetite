import React from "react";
import { render } from "@testing-library/react-native";
import { PulsingMapPin } from "./PulsingMapPin";
import { ThemeProvider } from "../theme/ThemeProvider";
import { heatColor } from "../theme/heat";
import { getTimeLeft, getUrgencyRatio } from "../utils/time";

const NOW = new Date("2026-01-01T12:00:00.000Z").getTime();
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

/** Все backgroundColor из дерева рендера — точка и пульс-кольцо красятся одним цветом жара. */
function backgroundColors(node: unknown, acc: string[] = []): string[] {
  if (!node || typeof node !== "object") return acc;
  const { props, children } = node as { props?: { style?: unknown }; children?: unknown[] | null };
  const flat = ([] as unknown[]).concat(props?.style ?? []).flat(Infinity) as Array<Record<string, unknown> | null | undefined>;
  for (const s of flat) {
    if (s && typeof s.backgroundColor === "string") acc.push(s.backgroundColor);
  }
  (children ?? []).forEach((c) => backgroundColors(c, acc));
  return acc;
}

function dotColors(pickupEnd: string): string[] {
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  const view = render(
    <ThemeProvider>
      <PulsingMapPin discountPercent={50} pickupEnd={pickupEnd} />
    </ThemeProvider>
  );
  return backgroundColors(view.toJSON());
}

describe("PulsingMapPin", () => {
  afterEach(() => jest.restoreAllMocks());

  it("красит точку по времени до конца акции — мята, когда времени много, красный, когда мало", () => {
    const calm = dotColors(at(170));
    const urgent = dotColors(at(10));

    const expected = (minutes: number) =>
      (["light", "dark"] as const).map((mode) => heatColor(getUrgencyRatio(getTimeLeft(at(minutes), NOW)), mode));

    expect(calm.some((c) => expected(170).includes(c))).toBe(true);
    expect(urgent.some((c) => expected(10).includes(c))).toBe(true);
    expect(expected(170)).not.toEqual(expected(10));
  });

  it("цвет не зависит от величины скидки — она задаёт только размер и пульс", () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    const colorsFor = (discountPercent: number) =>
      backgroundColors(
        render(
          <ThemeProvider>
            <PulsingMapPin discountPercent={discountPercent} pickupEnd={at(40)} />
          </ThemeProvider>
        ).toJSON()
      ).filter((c) => /^#[0-9a-f]{6}$/i.test(c));

    expect(colorsFor(30)).toEqual(colorsFor(70));
  });

  it("подписывает скидку на метке", () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    const view = render(
      <ThemeProvider>
        <PulsingMapPin discountPercent={65} pickupEnd={at(60)} />
      </ThemeProvider>
    );
    expect(view.getByText("−65%")).toBeTruthy();
  });
});
