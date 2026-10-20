import { dayPalette, hourOf, isMoonHour, orbElevation } from "./dayPhase";

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const distance = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

describe("hourOf", () => {
  it("is the fractional local hour", () => {
    expect(hourOf(new Date(2026, 0, 1, 14, 30))).toBeCloseTo(14.5, 5);
    expect(hourOf(new Date(2026, 0, 1, 0, 0, 36))).toBeCloseTo(0.01, 5);
  });
});

describe("dayPalette", () => {
  it("is a starry night with a moon at 3 a.m.", () => {
    const night = dayPalette(3);
    expect(night.name).toBe("night");
    expect(night.moon).toBe(true);
    expect(night.stars).toBeGreaterThan(0.9);
  });

  it("is a bright day with a high sun and no stars at noon", () => {
    const noon = dayPalette(13);
    expect(noon.name).toBe("day");
    expect(noon.moon).toBe(false);
    expect(noon.stars).toBe(0);
    expect(noon.elevation).toBeGreaterThan(0.95);
  });

  it("warms up at dawn and at sunset, and the sun stands low then", () => {
    for (const hour of [6.5, 19.5]) {
      const warm = dayPalette(hour);
      expect(warm.elevation).toBeLessThan(0.5);
      const [r, , b] = rgb(warm.skyBottom);
      expect(r).toBeGreaterThan(b); // тёплый низ неба: красного больше, чем синего
    }
    expect(dayPalette(12).skyBottom).not.toBe(dayPalette(19.5).skyBottom);
  });

  it("names the phases through the day", () => {
    expect([2, 7, 12, 18, 20, 21.5, 23].map((h) => dayPalette(h).name)).toEqual(["night", "dawn", "day", "golden", "sunset", "dusk", "night"]);
  });

  it("flows instead of jumping: neighbouring moments are neighbouring colours, all day long", () => {
    for (let h = 0; h < 24; h += 0.05) {
      const a = dayPalette(h);
      const b = dayPalette(h + 0.05);
      for (const key of ["skyTop", "skyBottom", "glow", "orbTop", "orbBottom"] as const) {
        expect(distance(a[key], b[key])).toBeLessThan(14);
      }
    }
  });

  it("wraps around midnight and tolerates hours outside 0..24", () => {
    expect(dayPalette(24)).toEqual(dayPalette(0));
    expect(dayPalette(-1)).toEqual(dayPalette(23));
    expect(dayPalette(25.5)).toEqual(dayPalette(1.5));
  });
});

describe("sun, moon and elevation", () => {
  it("the sun is up from 5:30 to 20:30, the moon the rest of the time", () => {
    expect([5.49, 5.5, 12, 20.49, 20.5, 23].map(isMoonHour)).toEqual([true, false, false, false, true, true]);
  });

  it("the disc touches the horizon at sunrise and sunset and peaks at noon and at midnight-ish", () => {
    expect(orbElevation(5.5)).toBeCloseTo(0, 5);
    expect(orbElevation(20.5)).toBeCloseTo(0, 5);
    expect(orbElevation(13)).toBeCloseTo(1, 2);
    expect(orbElevation(1)).toBeCloseTo(1, 2);
    expect(orbElevation(23)).toBeGreaterThan(0.5);
  });
});
