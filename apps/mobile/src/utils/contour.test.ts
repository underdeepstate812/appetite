import { contour, hashString } from "./contour";

describe("contour", () => {
  it("builds a closed path", () => {
    const path = contour(50, 50, 20, 0.5);
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
  });

  it("changes shape with the phase", () => {
    expect(contour(50, 50, 20, 0.5)).not.toBe(contour(50, 50, 20, 2));
  });
});

describe("hashString", () => {
  it("is stable, within 0..1 and different for different ids", () => {
    expect(hashString("offer-1")).toBe(hashString("offer-1"));
    expect(hashString("offer-1")).not.toBe(hashString("offer-2"));
    for (const id of ["a", "offer-1", "0d7f2c40-5b1e-4f0a-9d3e-1c2b3a4d5e6f"]) {
      const value = hashString(id);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
