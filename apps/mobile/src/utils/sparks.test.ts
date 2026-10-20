import { buildSparks, SPARK_KEYS } from "./sparks";

describe("buildSparks", () => {
  const sparks = buildSparks(28);

  it("builds one keyframe per key for every spark", () => {
    expect(sparks).toHaveLength(28);
    for (const spark of sparks) {
      expect(spark.x).toHaveLength(SPARK_KEYS.length);
      expect(spark.y).toHaveLength(SPARK_KEYS.length);
      expect(spark.opacity).toHaveLength(SPARK_KEYS.length);
    }
  });

  it("rises: every spark ends above where it started (negative y)", () => {
    for (const spark of sparks) expect(spark.y[spark.y.length - 1]).toBeLessThan(0);
  });

  it("fades in from nothing and is gone by the end of its life", () => {
    for (const spark of sparks) {
      expect(spark.opacity[0]).toBe(0);
      expect(spark.opacity[1]).toBe(1);
      expect(spark.opacity[spark.opacity.length - 1]).toBe(0);
    }
  });

  it("is deterministic for the same seed and differs for another one", () => {
    expect(buildSparks(10)).toEqual(buildSparks(10));
    expect(buildSparks(10, 3)).not.toEqual(buildSparks(10));
  });

  it("splits the palette 40/30/20/10", () => {
    const counts = [0, 0, 0, 0];
    for (const spark of buildSparks(20)) counts[spark.colorIndex] += 1;
    expect(counts).toEqual([8, 6, 4, 2]);
  });
});
