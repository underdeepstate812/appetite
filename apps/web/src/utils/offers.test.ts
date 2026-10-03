import { describe, expect, it } from "vitest";
import { isHotOffer, sortHotFirst } from "./offers";
import { pinSpec } from "./mapPins";

const NOW = Date.parse("2026-10-03T12:00:00Z");
const end = (hours: number) => new Date(NOW + hours * 3600_000).toISOString();
const offer = (over: Partial<{ pickupEnd: string; discountPercent: number; distanceKm: number; featured: boolean }> = {}) => ({
  pickupEnd: end(5), discountPercent: 40, distanceKm: 1, ...over,
});

describe("featured offer ('предложение дня')", () => {
  it("is hot for the whole 24h window although by time alone it is calm", () => {
    expect(isHotOffer(offer({ pickupEnd: end(24) }), NOW)).toBe(false);
    expect(isHotOffer(offer({ pickupEnd: end(24), featured: true }), NOW)).toBe(true);
    expect(isHotOffer(offer({ pickupEnd: end(23.9), featured: true }), NOW)).toBe(true);
  });

  it("stops being hot once its window is over", () => {
    expect(isHotOffer(offer({ pickupEnd: end(-1), featured: true }), NOW)).toBe(false);
  });

  it("goes FIRST, ahead of regular offers that are about to burn out and of bigger discounts", () => {
    const burning = offer({ pickupEnd: end(0.5), discountPercent: 70, distanceKm: 0.1 });
    const featured = offer({ pickupEnd: end(24), discountPercent: 70, distanceKm: 9, featured: true });
    const calm = offer({ pickupEnd: end(5), discountPercent: 50 });
    const sorted = sortHotFirst([calm, burning, featured], NOW);
    expect(sorted[0]).toBe(featured);
    expect(sorted[1]).toBe(burning);
  });

  it("an expired featured offer does not stay on top", () => {
    const expired = offer({ pickupEnd: end(-2), featured: true });
    const calm = offer({ pickupEnd: end(5) });
    expect(sortHotFirst([expired, calm], NOW)[0]).toBe(calm);
  });
});

describe("pinSpec", () => {
  it("draws the featured pin biggest and in the hottest colour, flagged for the halo", () => {
    const regular = pinSpec({ discountPercent: 65, pickupEnd: end(5) }, false);
    const featured = pinSpec({ discountPercent: 70, pickupEnd: end(24), featured: true }, false);
    expect(featured.featured).toBe(true);
    expect(regular.featured).toBe(false);
    expect(featured.size).toBeGreaterThan(regular.size);
    expect(featured.color).not.toBe(regular.color); // 'calm' teal vs. critical red
    expect(featured.color.toLowerCase()).toBe("#d92d20");
  });
});
