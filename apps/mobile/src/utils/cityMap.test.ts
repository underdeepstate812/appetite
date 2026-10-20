import { CENTER_CLEARING, buildCityMap, distanceToPolyline, riverDistance } from "./cityMap";

const map = buildCityMap();
const center = { x: 50, y: 50 };
const away = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);

describe("buildCityMap", () => {
  it("draws the same city every time (no randomness between shows)", () => {
    expect(JSON.stringify(buildCityMap())).toBe(JSON.stringify(map));
  });

  it("has a river across the whole picture, canals, parks and a real city fabric of blocks", () => {
    const xs = map.river.points.map((p) => p.x);
    expect(Math.min(...xs)).toBeLessThanOrEqual(0);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(100);
    expect(map.canals.length).toBeGreaterThanOrEqual(2);
    expect(map.parks.length).toBeGreaterThanOrEqual(3);
    expect(map.blocks.count).toBeGreaterThan(60);
    expect(map.blocks.count).toBeLessThan(220);
    expect(map.blocks.faint && map.blocks.mid && map.blocks.strong).toBeTruthy();
  });

  it("keeps the 'you are here' point clear and puts the offer pins on land, away from the stickers", () => {
    expect(map.pois.length).toBeGreaterThanOrEqual(8);
    for (const poi of map.pois) {
      expect(away(poi, center)).toBeGreaterThan(CENTER_CLEARING);
      expect(riverDistance(poi)).toBeGreaterThan(map.river.width / 2);
      for (const sticker of [{ x: 20, y: 30 }, { x: 80, y: 23 }, { x: 80, y: 78 }]) expect(away(poi, sticker)).toBeGreaterThan(10);
    }
    expect(new Set(map.pois.map((p) => p.kind)).size).toBeGreaterThanOrEqual(2);
  });

  it("has clean rectangular parks (no blobs) with a garden label inside the first one", () => {
    expect(map.parks.every((park) => /^M[\d. -]+( L[\d. -]+){3} Z$/.test(park.d))).toBe(true);
    const garden = map.labels.find((l) => l.text === "Летний сад")!;
    expect(away(garden, { x: map.parks[0].cx, y: map.parks[0].cy })).toBeLessThan(map.parks[0].r + 2);
  });

  it("walks from the 'you are here' point in the centre to the −55% sticker along straight street segments", () => {
    expect(map.route.d.startsWith("M50 50")).toBe(true);
    expect(away(map.route.end, { x: 80, y: 23 })).toBeLessThan(6);
    expect(map.route.d.split("L").length).toBeGreaterThanOrEqual(4);
  });

  it("labels the river, the avenue, the canal and the garden", () => {
    expect(map.labels.map((l) => l.text)).toEqual(["НЕВА", "Невский пр.", "Фонтанка", "Летний сад"]);
  });
});

describe("distanceToPolyline", () => {
  it("is the distance to the nearest sample", () => {
    expect(distanceToPolyline({ x: 0, y: 3 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(3);
  });
});
