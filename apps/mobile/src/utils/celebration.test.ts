import { hasCelebrated, markCelebrated } from "./celebration";

describe("celebration once per order", () => {
  it("remembers orders that already had their moment", () => {
    expect(hasCelebrated("order-1")).toBe(false);
    markCelebrated("order-1");
    expect(hasCelebrated("order-1")).toBe(true);
    expect(hasCelebrated("order-2")).toBe(false);
  });
});
