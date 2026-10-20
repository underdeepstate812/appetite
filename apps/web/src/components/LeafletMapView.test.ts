import { describe, expect, it } from "vitest";
import { driftPosition } from "./LeafletMapView";

describe("driftPosition", () => {
  it("starts exactly at the initial camera position", () => {
    expect(driftPosition(0)).toEqual({ x: 0, y: 0 });
  });

  it("is periodic (returns to start after one period) and stays within the amplitude", () => {
    const end = driftPosition(36_000);
    expect(Math.abs(end.x)).toBeLessThan(1e-6);
    expect(Math.abs(end.y)).toBeLessThan(1e-6);
    for (let t = 0; t <= 36_000; t += 500) {
      const { x, y } = driftPosition(t);
      expect(Math.abs(x)).toBeLessThanOrEqual(60.0001);
      expect(Math.abs(y)).toBeLessThanOrEqual(40.0001);
    }
  });

  it("actually moves (not a stand-still)", () => {
    const a = driftPosition(2_000);
    expect(Math.hypot(a.x, a.y)).toBeGreaterThan(8);
  });
});
