import { describe, expect, it } from "vitest";
import { COVERAGE_KM, SPB_CENTER, distanceKm, isInCoverage } from "./geo";

describe("distanceKm", () => {
  it("is zero for the same point and symmetric", () => {
    expect(distanceKm(SPB_CENTER, SPB_CENTER)).toBe(0);
    const moscow = { lat: 55.7558, lng: 37.6173 };
    expect(distanceKm(SPB_CENTER, moscow)).toBeCloseTo(distanceKm(moscow, SPB_CENTER), 6);
  });

  it("knows the Saint Petersburg → Moscow distance (~634 km by great circle)", () => {
    expect(distanceKm(SPB_CENTER, { lat: 55.7558, lng: 37.6173 })).toBeGreaterThan(620);
    expect(distanceKm(SPB_CENTER, { lat: 55.7558, lng: 37.6173 })).toBeLessThan(650);
  });

  it("measures a short walk: ~1 km north is ~0.009° of latitude", () => {
    expect(distanceKm(SPB_CENTER, { lat: SPB_CENTER.lat + 0.009, lng: SPB_CENTER.lng })).toBeCloseTo(1, 1);
  });
});

describe("isInCoverage", () => {
  it("covers the whole city including the far districts, not Moscow", () => {
    expect(isInCoverage(SPB_CENTER)).toBe(true);
    expect(isInCoverage({ lat: 60.0, lng: 30.2 })).toBe(true); // Лахта/Приморский — ~12 км
    expect(isInCoverage({ lat: 55.7558, lng: 37.6173 })).toBe(false);
    expect(COVERAGE_KM).toBeGreaterThan(20); // шире радиуса запроса витрины
  });
});
