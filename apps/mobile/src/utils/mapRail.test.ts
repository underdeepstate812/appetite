import { centerLatForInset, indexFromOffset, indexOfOffer, offsetForIndex, railMetrics } from "./mapRail";

describe("railMetrics", () => {
  it("leaves a peeking edge of the next card on typical phones", () => {
    for (const width of [360, 390, 402, 430]) {
      const m = railMetrics(width);
      // слева отступ, карточка, зазор — и ещё видна полоска следующей
      const visibleOfNext = width - (m.inset + m.cardWidth + m.gap);
      expect(visibleOfNext).toBeGreaterThanOrEqual(28);
      expect(visibleOfNext).toBeLessThanOrEqual(60); // на широких телефонах карточка упирается в максимум, и «выглядывание» чуть больше
      expect(m.snap).toBe(m.cardWidth + m.gap);
    }
  });

  it("keeps cards between a readable minimum and a sane maximum", () => {
    expect(railMetrics(320).cardWidth).toBeGreaterThanOrEqual(264);
    expect(railMetrics(1200).cardWidth).toBe(344);
    expect(railMetrics(768).cardWidth).toBe(344);
  });

  it("survives a broken width", () => {
    for (const bad of [0, -10, Number.NaN, Number.POSITIVE_INFINITY * 0]) expect(railMetrics(bad).cardWidth).toBeGreaterThan(200);
  });
});

describe("indexFromOffset / offsetForIndex", () => {
  const snap = 300;

  it("rounds to the card the finger has settled on", () => {
    expect(indexFromOffset(0, snap, 5)).toBe(0);
    expect(indexFromOffset(140, snap, 5)).toBe(0);
    expect(indexFromOffset(160, snap, 5)).toBe(1);
    expect(indexFromOffset(600, snap, 5)).toBe(2);
  });

  it("clamps overscroll (rubber band) to the first and last card", () => {
    expect(indexFromOffset(-80, snap, 5)).toBe(0);
    expect(indexFromOffset(99999, snap, 5)).toBe(4);
  });

  it("is safe with no cards or a broken offset", () => {
    expect(indexFromOffset(500, snap, 0)).toBe(0);
    expect(indexFromOffset(Number.NaN, snap, 5)).toBe(0);
    expect(indexFromOffset(500, 0, 5)).toBe(0);
  });

  it("round-trips: the offset of an index maps back to that index", () => {
    for (let i = 0; i < 6; i += 1) expect(indexFromOffset(offsetForIndex(i, snap), snap, 6)).toBe(i);
    expect(offsetForIndex(-3, snap)).toBe(0);
  });
});

describe("indexOfOffer", () => {
  const offers = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("finds the card of a selected offer, -1 when none", () => {
    expect(indexOfOffer(offers, "b")).toBe(1);
    expect(indexOfOffer(offers, "zzz")).toBe(-1);
    expect(indexOfOffer(offers, null)).toBe(-1);
    expect(indexOfOffer([], "a")).toBe(-1);
  });
});

describe("centerLatForInset", () => {
  it("puts the map centre BELOW the pin by half the covered strip, so the pin sits in the visible part", () => {
    // карта 800 px высотой = 0.08° широты; лента закрывает 200 px → центр на 100 px (0.01°) ниже пина
    expect(centerLatForInset(59.93, 0.08, 800, 200)).toBeCloseTo(59.92, 6);
  });

  it("does nothing without a covered strip or with broken input", () => {
    expect(centerLatForInset(59.93, 0.08, 800, 0)).toBe(59.93);
    expect(centerLatForInset(59.93, 0, 800, 200)).toBe(59.93);
    expect(centerLatForInset(59.93, 0.08, 0, 200)).toBe(59.93);
    expect(centerLatForInset(59.93, Number.NaN, 800, 200)).toBe(59.93);
  });

  it("a taller strip shifts the centre further down", () => {
    expect(centerLatForInset(59.93, 0.08, 800, 300)).toBeLessThan(centerLatForInset(59.93, 0.08, 800, 150));
  });
});
