import { describe, expect, it } from "vitest";
import { formatDistance, formatTimeLeft } from "./format";

describe("formatTimeLeft", () => {
  it("formats hours, minutes and the sub-minute case", () => {
    expect(formatTimeLeft(125)).toBe("2 ч 05 мин");
    expect(formatTimeLeft(25)).toBe("25 мин");
    expect(formatTimeLeft(0)).toBe("меньше минуты");
  });
});

describe("formatDistance", () => {
  it("uses meters under a kilometer (rounded to 50 m) and km above", () => {
    expect(formatDistance(0.37)).toBe("350 м");
    expect(formatDistance(0.01)).toBe("50 м");
    expect(formatDistance(1.26)).toBe("1,3 км");
  });
});

import { formatPickupEnd, formatPickupWindow } from "./format";

describe("pickup window labels", () => {
  const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).toISOString();

  it("same-day windows keep the short form", () => {
    expect(formatPickupEnd(at(3, 18, 35), new Date(2026, 9, 3, 12).getTime())).toBe("до 18:35");
    expect(formatPickupWindow(at(3, 17, 35), at(3, 18, 35))).toBe("17:35–18:35");
  });

  it("a 24h window says 'завтра' so '18:35' is not mistaken for today", () => {
    expect(formatPickupEnd(at(4, 18, 35), new Date(2026, 9, 3, 18, 36).getTime())).toBe("до завтра 18:35");
    expect(formatPickupWindow(at(3, 17, 35), at(4, 18, 35))).toBe("17:35 — завтра 18:35");
  });
});
