import { isHotOffer, sortHotFirst } from "./offers";

const NOW = new Date("2026-01-01T12:00:00.000Z").getTime();

function offer(id: string, minutesLeft: number, discountPercent: number, distanceKm = 1) {
  return { id, pickupEnd: new Date(NOW + minutesLeft * 60_000).toISOString(), discountPercent, distanceKm };
}

describe("isHotOffer", () => {
  it("is hot in the last ~80 minutes of the window", () => {
    expect(isHotOffer(offer("a", 30, 50), NOW)).toBe(true);
    expect(isHotOffer(offer("b", 80, 50), NOW)).toBe(true);
  });

  it("is not hot with plenty of time left", () => {
    expect(isHotOffer(offer("a", 150, 70), NOW)).toBe(false);
  });

  it("is not hot once the window has closed", () => {
    expect(isHotOffer(offer("a", -5, 70), NOW)).toBe(false);
  });
});

describe("sortHotFirst", () => {
  it("puts hot offers first, then orders each group by discount descending", () => {
    const sorted = sortHotFirst(
      [
        offer("calm-70", 150, 70),
        offer("hot-40", 30, 40),
        offer("calm-50", 170, 50),
        offer("hot-60", 60, 60),
      ],
      NOW
    );
    expect(sorted.map((o) => o.id)).toEqual(["hot-60", "hot-40", "calm-70", "calm-50"]);
  });

  it("breaks discount ties by earlier pickup end, then by distance", () => {
    const sorted = sortHotFirst(
      [offer("far", 150, 50, 5), offer("near", 150, 50, 1), offer("soon", 140, 50, 9)],
      NOW
    );
    expect(sorted.map((o) => o.id)).toEqual(["soon", "near", "far"]);
  });

  it("puts offers whose pickup window has already closed at the very end, even with a big discount", () => {
    const sorted = sortHotFirst([offer("closed-70", -10, 70), offer("calm-30", 150, 30), offer("hot-40", 30, 40)], NOW);
    expect(sorted.map((o) => o.id)).toEqual(["hot-40", "calm-30", "closed-70"]);
  });

  it("does not mutate the input array", () => {
    const input = [offer("a", 150, 40), offer("b", 30, 60)];
    const copy = [...input];
    sortHotFirst(input, NOW);
    expect(input).toEqual(copy);
  });
});

describe("featured offer ('предложение дня')", () => {
  const featured = (id: string, minutesLeft: number, discountPercent: number) => ({ ...offer(id, minutesLeft, discountPercent), featured: true });

  it("is hot for its whole 24h window although by time alone it is calm", () => {
    expect(isHotOffer(offer("a", 24 * 60, 70), NOW)).toBe(false);
    expect(isHotOffer(featured("a", 24 * 60, 70), NOW)).toBe(true);
  });

  it("is not hot once the window has closed", () => {
    expect(isHotOffer(featured("a", -5, 70), NOW)).toBe(false);
  });

  it("goes first, ahead of a regular offer that is about to burn out", () => {
    const burning = offer("burning", 20, 70, 0.1);
    const day = featured("day", 24 * 60, 70);
    expect(sortHotFirst([burning, day], NOW).map((o) => o.id)).toEqual(["day", "burning"]);
  });
});
