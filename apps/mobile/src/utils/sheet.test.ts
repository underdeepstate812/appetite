import { DISMISS_DISTANCE, DISMISS_VELOCITY, dragOffset, shouldDismissSheet } from "./sheet";

describe("shouldDismissSheet", () => {
  it("closes when dragged far enough, however slowly", () => {
    expect(shouldDismissSheet(DISMISS_DISTANCE, 0)).toBe(true);
    expect(shouldDismissSheet(DISMISS_DISTANCE + 80, 0.1)).toBe(true);
  });

  it("closes on a quick downward flick even over a short distance", () => {
    expect(shouldDismissSheet(40, DISMISS_VELOCITY)).toBe(true);
  });

  it("springs back after a short, slow drag", () => {
    expect(shouldDismissSheet(60, 0.2)).toBe(false);
    expect(shouldDismissSheet(DISMISS_DISTANCE - 1, 0.79)).toBe(false);
  });

  it("ignores an accidental touch: a fast but tiny movement does not close", () => {
    expect(shouldDismissSheet(8, 2)).toBe(false);
    expect(shouldDismissSheet(19, 5)).toBe(false);
  });

  it("never closes when dragged upward", () => {
    expect(shouldDismissSheet(-80, 3)).toBe(false);
  });
});

describe("dragOffset", () => {
  it("follows the finger one to one when dragging down", () => {
    expect(dragOffset(0)).toBe(0);
    expect(dragOffset(137)).toBe(137);
  });

  it("resists dragging up (rubber band)", () => {
    expect(dragOffset(-100)).toBeCloseTo(-12);
    expect(Math.abs(dragOffset(-400))).toBeLessThan(60);
  });
});
