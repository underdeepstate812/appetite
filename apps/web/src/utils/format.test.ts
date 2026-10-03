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
