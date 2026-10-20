import { SPLASH_MIN_MS, SPLASH_MIN_MS_REDUCED, remainingSplashMs } from "./boot";

describe("remainingSplashMs", () => {
  it("keeps the splash for the rest of its minimum when the app was ready early", () => {
    expect(remainingSplashMs(120, 900)).toBe(780);
    expect(remainingSplashMs(0, 900)).toBe(900);
  });

  it("removes it at once when the app became ready after the minimum", () => {
    expect(remainingSplashMs(900, 900)).toBe(0);
    expect(remainingSplashMs(3200, 900)).toBe(0);
  });

  it("treats a negative or broken elapsed time as 'just appeared'", () => {
    expect(remainingSplashMs(-50, 900)).toBe(900);
    expect(remainingSplashMs(Number.NaN, 900)).toBe(900);
    expect(remainingSplashMs(Number.POSITIVE_INFINITY, 900)).toBe(900);
  });

  it("the reduced-motion minimum is a short flash, not the full breath", () => {
    expect(SPLASH_MIN_MS_REDUCED).toBeLessThan(SPLASH_MIN_MS);
    expect(SPLASH_MIN_MS_REDUCED).toBeGreaterThan(0);
  });
});
