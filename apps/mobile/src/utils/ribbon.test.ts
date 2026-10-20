import type { NearbyOffer } from "@apetite/shared";
import { RIBBON_CARD_WIDTH, RIBBON_GAP, ribbonDurationMs, ribbonGeometry, ribbonOffers } from "./ribbon";

const NOW = new Date("2026-10-06T12:00:00.000Z").getTime();
const min = (m: number) => new Date(NOW + m * 60_000).toISOString();
function offer(id: string, over: Partial<NearbyOffer> = {}): NearbyOffer {
  return { id, businessId: `b-${id}`, pickupStart: min(-60), pickupEnd: min(120), quantityLeft: 3, discountPercent: 50, distanceKm: 1, featured: false, ...over } as NearbyOffer;
}

describe("ribbonOffers", () => {
  it("keeps only what can be picked up right now: open window, in stock", () => {
    const shown = ribbonOffers(
      [offer("ok"), offer("later", { pickupStart: min(30) }), offer("closed", { pickupEnd: min(-5) }), offer("sold", { quantityLeft: 0 })],
      NOW,
      false
    );
    expect(shown.map((o) => o.id)).toEqual(["ok"]);
  });

  it("puts the hottest first when the position is unknown", () => {
    const shown = ribbonOffers([offer("calm", { pickupEnd: min(170), discountPercent: 70 }), offer("hot", { pickupEnd: min(20), discountPercent: 40 })], NOW, false);
    expect(shown[0].id).toBe("hot");
  });

  it("puts the nearest first when the person is located", () => {
    const shown = ribbonOffers([offer("far", { distanceKm: 6 }), offer("near", { distanceKm: 0.3 })], NOW, true);
    expect(shown.map((o) => o.id)).toEqual(["near", "far"]);
  });

  it("prefers different venues: a second offer of the same venue goes after all the others", () => {
    const shown = ribbonOffers(
      [offer("a1", { businessId: "A", discountPercent: 70 }), offer("a2", { businessId: "A", discountPercent: 65 }), offer("b1", { businessId: "B", discountPercent: 40 })],
      NOW,
      false
    );
    expect(shown.map((o) => o.id)).toEqual(["a1", "b1", "a2"]);
  });

  it("is capped", () => {
    const many = Array.from({ length: 30 }, (_, i) => offer(`o${i}`));
    expect(ribbonOffers(many, NOW, false)).toHaveLength(10);
    expect(ribbonOffers(many, NOW, false, 4)).toHaveLength(4);
  });
});

describe("ribbonGeometry", () => {
  it("the loop is one full set of cards", () => {
    expect(ribbonGeometry(5, 390).setWidth).toBe(5 * (RIBBON_CARD_WIDTH + RIBBON_GAP));
  });

  it("repeats the set enough to leave no gap on the right, on any screen", () => {
    for (const width of [320, 390, 768, 1280, 2560]) {
      for (const count of [3, 5, 10]) {
        const { setWidth, copies } = ribbonGeometry(count, width);
        // видимая ширина + путь одной петли должны уместиться в copies наборах
        expect(copies * setWidth).toBeGreaterThanOrEqual(width + setWidth);
        expect(copies).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("has nothing to draw without cards", () => {
    expect(ribbonGeometry(0, 390)).toEqual({ setWidth: 0, copies: 0 });
  });
});

describe("ribbonDurationMs", () => {
  it("is distance over speed", () => {
    expect(ribbonDurationMs(340, 34)).toBe(10_000);
    expect(ribbonDurationMs(0, 34)).toBe(0);
    expect(ribbonDurationMs(100, 0)).toBe(0);
  });
});
