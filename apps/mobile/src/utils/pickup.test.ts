import { formatPickupDeadline, formatPickupWindow, windowOpensLater, windowRemaining } from "./pickup";

const labels = { tomorrow: "завтра", locale: "ru-RU" };
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).toISOString();
const ms = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();

describe("formatPickupWindow", () => {
  it("keeps the short form inside one day", () => {
    expect(formatPickupWindow(at(3, 17, 35), at(3, 18, 35), labels)).toBe("17:35–18:35");
  });

  it("says 'завтра' when the window crosses midnight so 18:35 is not mistaken for today", () => {
    expect(formatPickupWindow(at(3, 17, 35), at(4, 18, 35), labels)).toBe("17:35 — завтра 18:35");
  });

  it("uses the provided word for other languages", () => {
    expect(formatPickupWindow(at(3, 17, 35), at(4, 18, 35), { tomorrow: "tomorrow", locale: "en-GB" })).toMatch(/tomorrow/);
  });
});

describe("formatPickupDeadline", () => {
  it("is just the closing time inside one day", () => {
    expect(formatPickupDeadline(at(3, 17, 35), at(3, 18, 35), labels)).toBe("18:35");
  });

  it("adds 'завтра' when the window closes on the next day", () => {
    expect(formatPickupDeadline(at(3, 17, 35), at(4, 18, 35), labels)).toBe("завтра 18:35");
  });
});

describe("windowRemaining", () => {
  const start = at(3, 10);
  const end = at(3, 12);
  it("is 1 before the window opens, 0 after it closes, linear in between", () => {
    expect(windowRemaining(start, end, ms(3, 9))).toBe(1);
    expect(windowRemaining(start, end, ms(3, 10, 30))).toBeCloseTo(0.75);
    expect(windowRemaining(start, end, ms(3, 11))).toBeCloseTo(0.5);
    expect(windowRemaining(start, end, ms(3, 12, 1))).toBe(0);
  });

  it("is 0 for a broken (inverted) window instead of NaN", () => {
    expect(windowRemaining(end, start, ms(3, 11))).toBe(0);
  });
});

describe("windowOpensLater", () => {
  it("is true only while the start is in the future", () => {
    expect(windowOpensLater(at(3, 10), ms(3, 9))).toBe(true);
    expect(windowOpensLater(at(3, 10), ms(3, 11))).toBe(false);
  });
});
