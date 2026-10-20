import { describe, expect, it } from "vitest";
import { OfferCategory } from "@apetite/shared";
import { countByCategory, filterOffers, isHotOffer, isOfferCategory, priceBounds, sanitizeCategory, sortHotFirst, sortNearestFirst } from "./offers";
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
    // «Сейчас» передаём явно: фикстура привязана к NOW, а по реальным часам оба оффера со временем «истекают» и цвета совпадают.
    const regular = pinSpec({ discountPercent: 65, pickupEnd: end(5) }, false, NOW);
    const featured = pinSpec({ discountPercent: 70, pickupEnd: end(24), featured: true }, false, NOW);
    expect(featured.featured).toBe(true);
    expect(regular.featured).toBe(false);
    expect(featured.size).toBeGreaterThan(regular.size);
    expect(featured.color).not.toBe(regular.color); // 'calm' teal vs. critical red
    expect(featured.color.toLowerCase()).toBe("#d92d20");
  });
});

describe("sortNearestFirst ('рядом со мной')", () => {
  it("puts the closest offer first even if a farther one is hotter or featured", () => {
    const near = offer({ distanceKm: 0.3, discountPercent: 40, pickupEnd: end(5) });
    const farHot = offer({ distanceKm: 4, discountPercent: 70, pickupEnd: end(0.5) });
    const farFeatured = offer({ distanceKm: 9, featured: true, pickupEnd: end(24) });
    expect(sortNearestFirst([farFeatured, farHot, near], NOW)).toEqual([near, farHot, farFeatured]);
  });

  it("treats distances within ~50 m as equal and then prefers the hot / bigger discount", () => {
    const a = offer({ distanceKm: 0.5, discountPercent: 40, pickupEnd: end(5) });
    const b = offer({ distanceKm: 0.52, discountPercent: 40, pickupEnd: end(0.5) });
    const c = offer({ distanceKm: 0.51, discountPercent: 60, pickupEnd: end(5) });
    expect(sortNearestFirst([a, c, b], NOW)).toEqual([b, c, a]); // горит > скидка больше > остальное
  });

  it("sends closed windows to the very end whatever their distance", () => {
    const closedNear = offer({ distanceKm: 0.1, pickupEnd: end(-1) });
    const open = offer({ distanceKm: 8 });
    expect(sortNearestFirst([closedNear, open], NOW)).toEqual([open, closedNear]);
  });

  it("does not mutate the input", () => {
    const list = [offer({ distanceKm: 3 }), offer({ distanceKm: 1 })];
    const copy = [...list];
    sortNearestFirst(list, NOW);
    expect(list).toEqual(copy);
  });
});

describe("filterOffers", () => {
  const item = (category: OfferCategory, rub: number, hours = 5, featured = false) => ({ category, discountedPrice: rub * 100, pickupEnd: end(hours), featured }) as never;
  const list = [item(OfferCategory.FOOD, 150), item(OfferCategory.FOOD, 450, 0.5), item(OfferCategory.BAKERY, 200), item(OfferCategory.FLOWERS, 900, 24, true)];
  const none = { category: "all" as const, minRub: null, maxRub: null, onlyHot: false };

  it("with no filters nothing is dropped", () => {
    expect(filterOffers(list, none, NOW)).toHaveLength(4);
  });

  it("filters by category, price (inclusive bounds, in roubles vs kopecks) and 'only hot'", () => {
    expect(filterOffers(list, { ...none, category: OfferCategory.FOOD }, NOW)).toHaveLength(2);
    expect(filterOffers(list, { ...none, minRub: 200 }, NOW)).toHaveLength(3);
    expect(filterOffers(list, { ...none, maxRub: 200 }, NOW)).toHaveLength(2);
    expect(filterOffers(list, { ...none, minRub: 200, maxRub: 450 }, NOW)).toHaveLength(2);
    expect(filterOffers(list, { ...none, minRub: 150, maxRub: 150 }, NOW)).toHaveLength(1);
    expect(filterOffers(list, { ...none, onlyHot: true }, NOW)).toHaveLength(2); // горит по времени + предложение дня
  });

  it("combines the filters (all must hold)", () => {
    expect(filterOffers(list, { category: OfferCategory.FOOD, minRub: 400, maxRub: 500, onlyHot: true }, NOW)).toHaveLength(1);
    expect(filterOffers(list, { category: OfferCategory.BAKERY, minRub: 400, maxRub: null, onlyHot: false }, NOW)).toHaveLength(0);
  });
});

describe("countByCategory / priceBounds", () => {
  const item = (category: OfferCategory, rub: number) => ({ category, discountedPrice: rub * 100, pickupEnd: end(5) }) as never;
  const list = [item(OfferCategory.FOOD, 150), item(OfferCategory.FOOD, 450), item(OfferCategory.BAKERY, 200)];

  it("counts per category under the OTHER filters (the category itself is ignored)", () => {
    expect(countByCategory(list, { minRub: null, maxRub: null, onlyHot: false }, NOW)).toMatchObject({ all: 3, FOOD: 2, BAKERY: 1 });
    expect(countByCategory(list, { minRub: 200, maxRub: null, onlyHot: false }, NOW)).toMatchObject({ all: 2, FOOD: 1, BAKERY: 1 });
  });

  it("price bounds round outwards to whole roubles and are null for an empty list", () => {
    expect(priceBounds([{ discountedPrice: 7750 }, { discountedPrice: 220010 }])).toEqual({ min: 77, max: 2201 });
    expect(priceBounds([])).toBeNull();
  });
});

describe("categories: validation", () => {
  it("knows the real categories and nothing else", () => {
    for (const category of Object.values(OfferCategory)) expect(isOfferCategory(category)).toBe(true);
    for (const junk of ["", "all", "food", "FOODS", "Bakery", null, undefined, 0, {}, ["FOOD"]]) expect(isOfferCategory(junk)).toBe(false);
  });

  it("sanitizeCategory keeps a real category and turns everything else into 'all'", () => {
    expect(sanitizeCategory(OfferCategory.FLOWERS)).toBe(OfferCategory.FLOWERS);
    expect(sanitizeCategory("all")).toBe("all");
    expect(sanitizeCategory("pizza")).toBe("all");
    expect(sanitizeCategory(undefined)).toBe("all");
    expect(sanitizeCategory(42)).toBe("all");
  });

  it("filterOffers treats an unknown category as 'all' instead of showing an empty showcase", () => {
    const item = (category: string) => ({ category, discountedPrice: 10000, pickupEnd: end(5) }) as never;
    const list = [item("FOOD"), item("BAKERY")];
    expect(filterOffers(list, { category: "pizza" as never, minRub: null, maxRub: null, onlyHot: false }, NOW)).toHaveLength(2);
  });

  it("price bounds are per category when the list is narrowed to it", () => {
    const item = (category: OfferCategory, rub: number) => ({ category, discountedPrice: rub * 100 });
    const list = [item(OfferCategory.FOOD, 77), item(OfferCategory.FOOD, 450), item(OfferCategory.FLOWERS, 189), item(OfferCategory.FLOWERS, 935)];
    expect(priceBounds(list)).toEqual({ min: 77, max: 935 });
    expect(priceBounds(list.filter((o) => o.category === OfferCategory.FLOWERS))).toEqual({ min: 189, max: 935 });
    expect(priceBounds(list.filter((o) => o.category === OfferCategory.FOOD))).toEqual({ min: 77, max: 450 });
    expect(priceBounds(list.filter((o) => o.category === OfferCategory.BAKERY))).toBeNull();
  });

  it("a category with no offers under the price shows 0 (so the panel can disable it)", () => {
    const item = (category: OfferCategory, rub: number) => ({ category, discountedPrice: rub * 100, pickupEnd: end(5) }) as never;
    const list = [item(OfferCategory.FOOD, 150), item(OfferCategory.FLOWERS, 900)];
    const counts = countByCategory(list, { minRub: 500, maxRub: null, onlyHot: false }, NOW);
    expect(counts[OfferCategory.FLOWERS]).toBe(1);
    expect(counts[OfferCategory.FOOD]).toBe(0);
    expect(counts[OfferCategory.BAKERY]).toBe(0);
    expect(Object.keys(counts).sort()).toEqual(["all", ...Object.values(OfferCategory)].sort()); // каждая категория — с явным числом
  });
});
