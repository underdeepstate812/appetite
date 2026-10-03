import { getReadiness, getTimeLeft, getUrgencyRatio } from "./time";

const NOW = new Date("2026-01-01T12:00:00.000Z").getTime();
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

describe("getReadiness", () => {
  it("is 0 at the moment of ordering and grows linearly up to the start of the pickup window", () => {
    expect(getReadiness(at(0), at(60), NOW)).toBe(0);
    expect(getReadiness(at(-30), at(30), NOW)).toBeCloseTo(0.5, 5);
    expect(getReadiness(at(-45), at(15), NOW)).toBeCloseTo(0.75, 5);
  });

  it("is ready (1) once the window has opened", () => {
    expect(getReadiness(at(-90), at(-10), NOW)).toBe(1);
    expect(getReadiness(undefined, at(0), NOW)).toBe(1);
  });

  it("stays at 0 when the order time is unknown and the window is still ahead", () => {
    expect(getReadiness(undefined, at(30), NOW)).toBe(0);
  });

  it("does not go negative for a nonsensical order time in the future", () => {
    expect(getReadiness(at(20), at(10), NOW)).toBe(0);
  });
});

describe("urgency helpers", () => {
  it("maps the time left in the 3 hour window to a 0..1 heat ratio", () => {
    expect(getUrgencyRatio(getTimeLeft(at(180), NOW))).toBe(0);
    expect(getUrgencyRatio(getTimeLeft(at(90), NOW))).toBeCloseTo(0.5, 5);
    expect(getUrgencyRatio(getTimeLeft(at(-1), NOW))).toBe(1);
  });
});
