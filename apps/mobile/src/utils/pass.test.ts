import { levelProgressRatio, passBars, passSerial } from "./pass";

describe("passSerial", () => {
  it("is six digits in two groups, stable per user and different between users", () => {
    expect(passSerial("u1")).toMatch(/^\d{3} \d{3}$/);
    expect(passSerial("u1")).toBe(passSerial("u1"));
    expect(passSerial("u1")).not.toBe(passSerial("u2"));
  });
  it("copes with a missing id", () => {
    expect(passSerial(undefined)).toMatch(/^\d{3} \d{3}$/);
  });
});

describe("passBars", () => {
  it("gives the requested number of bars of width 1–3, the same every time", () => {
    const bars = passBars("u1", 30);
    expect(bars).toHaveLength(30);
    expect(bars.every((w) => w >= 1 && w <= 3)).toBe(true);
    expect(passBars("u1", 30)).toEqual(bars);
    expect(passBars("u2", 30)).not.toEqual(bars);
  });
});

describe("levelProgressRatio", () => {
  const level = { minPoints: 100 };
  it("is the share of the way to the next level", () => {
    expect(levelProgressRatio(150, level, { minPoints: 200 })).toBe(0.5);
  });
  it("is clamped and full at the top level", () => {
    expect(levelProgressRatio(50, level, { minPoints: 200 })).toBe(0);
    expect(levelProgressRatio(500, level, { minPoints: 200 })).toBe(1);
    expect(levelProgressRatio(500, level, null)).toBe(1);
  });
});
