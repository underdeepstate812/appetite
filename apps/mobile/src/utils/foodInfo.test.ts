import { OfferCategory } from "@apetite/shared";
import { foodInfoStatus, formatBestBefore } from "./foodInfo";

const complete = { category: OfferCategory.FOOD, ingredients: "Мука, вода", allergens: ["gluten"], allergensDeclared: true, bestBefore: "2026-10-05T20:00:00Z" };

describe("foodInfoStatus", () => {
  it("complete when ingredients, allergens and best-before are all declared", () => {
    expect(foodInfoStatus(complete)).toBe("complete");
  });

  it("'no allergens' counts as declared (empty list + declared flag)", () => {
    expect(foodInfoStatus({ ...complete, allergens: [] })).toBe("complete");
  });

  it("missing for food without info — a legacy offer must say 'ask the venue', not pretend there are no allergens", () => {
    expect(foodInfoStatus({ category: OfferCategory.FOOD })).toBe("missing");
    expect(foodInfoStatus({ ...complete, allergensDeclared: false })).toBe("missing");
    expect(foodInfoStatus({ ...complete, ingredients: "  " })).toBe("missing");
    expect(foodInfoStatus({ ...complete, bestBefore: null })).toBe("missing");
  });

  it("none for flowers", () => {
    expect(foodInfoStatus({ category: OfferCategory.FLOWERS })).toBe("none");
  });
});

describe("formatBestBefore", () => {
  it("is day, month and time", () => {
    const iso = new Date(2026, 9, 5, 18, 5).toISOString();
    expect(formatBestBefore(iso, "ru-RU")).toMatch(/5 окт\.?,? 18:05/);
  });
});
