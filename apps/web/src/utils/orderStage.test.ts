import { describe, expect, it } from "vitest";
import { getOrderStage, getReadiness } from "./orderStage";

const NOW = Date.parse("2026-10-03T12:00:00Z");
const iso = (minutesFromNow: number) => new Date(NOW + minutesFromNow * 60000).toISOString();

describe("getOrderStage", () => {
  it("stays on 'confirmed' until the business accepts, even when pickup starts soon", () => {
    expect(getOrderStage(null, iso(20), NOW)).toBe("confirmed");
    expect(getOrderStage(undefined, iso(1), NOW)).toBe("confirmed");
  });

  it("moves to 'preparing' only after acceptance", () => {
    expect(getOrderStage(iso(-5), iso(30), NOW)).toBe("preparing");
  });

  it("is 'ready' once the pickup window opens — regardless of acceptance (mobile parity)", () => {
    expect(getOrderStage(null, iso(-1), NOW)).toBe("ready");
    expect(getOrderStage(iso(-90), iso(-1), NOW)).toBe("ready");
  });
});

describe("getReadiness", () => {
  it("is 0 before acceptance instead of a fake percentage from the payment time", () => {
    expect(getReadiness(null, iso(60), NOW)).toBe(0);
  });

  it("grows linearly from acceptance to pickup start", () => {
    expect(getReadiness(iso(-30), iso(30), NOW)).toBeCloseTo(0.5);
    expect(getReadiness(iso(-10), iso(30), NOW)).toBeCloseTo(0.25);
  });

  it("is 1 when the window is open and 0 when acceptance is after pickup start", () => {
    expect(getReadiness(iso(-30), iso(-1), NOW)).toBe(1);
    expect(getReadiness(iso(40), iso(30), NOW)).toBe(0);
  });
});
