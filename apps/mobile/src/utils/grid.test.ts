import { CARD_MAX_WIDTH, CARD_MIN_WIDTH, GRID_GAP, getGridLayout } from "./grid";

describe("getGridLayout", () => {
  it("falls back to one full-width column until the container is measured", () => {
    expect(getGridLayout(null)).toEqual({ columns: 1, cardWidth: null });
    expect(getGridLayout(0)).toEqual({ columns: 1, cardWidth: null });
  });

  it("uses the whole width for a single column on a phone", () => {
    expect(getGridLayout(358)).toEqual({ columns: 1, cardWidth: 358 });
    expect(getGridLayout(300)).toEqual({ columns: 1, cardWidth: 300 });
  });

  it("adds columns instead of stretching cards", () => {
    for (const width of [660, 820, 1000, 1394, 1900]) {
      const { columns, cardWidth } = getGridLayout(width);
      expect(cardWidth).not.toBeNull();
      expect(cardWidth as number).toBeGreaterThanOrEqual(CARD_MIN_WIDTH);
      expect(cardWidth as number).toBeLessThanOrEqual(CARD_MAX_WIDTH);
      expect(columns * (cardWidth as number) + GRID_GAP * (columns - 1)).toBeLessThanOrEqual(width);
    }
    expect(getGridLayout(1394).columns).toBe(4);
    expect(getGridLayout(660).columns).toBe(2);
  });

  it("caps the card width when a single column is wider than the maximum", () => {
    expect(getGridLayout(520)).toEqual({ columns: 1, cardWidth: CARD_MAX_WIDTH });
  });
});
