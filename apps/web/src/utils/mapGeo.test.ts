import { describe, expect, it } from "vitest";
import { shiftedCenter } from "./mapGeo";

describe("shiftedCenter", () => {
  it("keeps the point when no shift is requested", () => {
    expect(shiftedCenter(59.93, 30.36, 16, 0, 0)).toEqual([30.36, 59.93]);
  });

  it("moves the centre WEST for dx>0 so the point appears to the right of centre; smaller shift at higher zoom", () => {
    const [lng16] = shiftedCenter(59.93, 30.36, 16, 200, 0);
    const [lng14] = shiftedCenter(59.93, 30.36, 14, 200, 0);
    expect(lng16).toBeLessThan(30.36);
    expect(30.36 - lng14).toBeGreaterThan(30.36 - lng16);
  });

  it("moves the centre SOUTH for dy>0 so the point appears above centre", () => {
    const [, lat] = shiftedCenter(59.93, 30.36, 16, 0, 150);
    expect(lat).toBeLessThan(59.93);
  });
});
