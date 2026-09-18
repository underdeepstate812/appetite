import { getTimeLeft, getUrgencyLevel, getUrgencyRatio } from "./time";

const NOW = new Date("2026-01-01T12:00:00.000Z").getTime();

function isoMinutesFromNow(minutes: number): string {
  return new Date(NOW + minutes * 60_000).toISOString();
}

describe("getTimeLeft", () => {
  it("splits the remaining time into hours and minutes", () => {
    const result = getTimeLeft(isoMinutesFromNow(150), NOW);
    expect(result).toEqual({ totalMinutes: 150, hours: 2, minutes: 30, isPast: false });
  });

  it("floors partial minutes instead of rounding", () => {
    const target = new Date(NOW + 90_000).toISOString(); // 1.5 minutes
    expect(getTimeLeft(target, NOW).totalMinutes).toBe(1);
  });

  it("clamps totalMinutes at 0 once the deadline has passed, never negative", () => {
    const result = getTimeLeft(isoMinutesFromNow(-30), NOW);
    expect(result.totalMinutes).toBe(0);
    expect(result.isPast).toBe(true);
  });

  it("treats the exact deadline instant as past", () => {
    expect(getTimeLeft(isoMinutesFromNow(0), NOW).isPast).toBe(true);
  });
});

describe("getUrgencyLevel", () => {
  it("is past once the deadline has passed", () => {
    expect(getUrgencyLevel(getTimeLeft(isoMinutesFromNow(-1), NOW))).toBe("past");
  });

  it("is urgent under an hour left", () => {
    expect(getUrgencyLevel(getTimeLeft(isoMinutesFromNow(59), NOW))).toBe("urgent");
  });

  it("is soon between one and two hours left", () => {
    expect(getUrgencyLevel(getTimeLeft(isoMinutesFromNow(90), NOW))).toBe("soon");
  });

  it("is normal beyond two hours left", () => {
    expect(getUrgencyLevel(getTimeLeft(isoMinutesFromNow(150), NOW))).toBe("normal");
  });

  it("treats the exact 60-minute boundary as soon, not urgent", () => {
    expect(getUrgencyLevel(getTimeLeft(isoMinutesFromNow(60), NOW))).toBe("soon");
  });

  it("treats the exact 120-minute boundary as normal, not soon", () => {
    expect(getUrgencyLevel(getTimeLeft(isoMinutesFromNow(120), NOW))).toBe("normal");
  });
});

describe("getUrgencyRatio", () => {
  it("is 1 (max heat) once past", () => {
    expect(getUrgencyRatio(getTimeLeft(isoMinutesFromNow(-5), NOW))).toBe(1);
  });

  it("is 0 (calm) at the start of the 3-hour window or beyond", () => {
    expect(getUrgencyRatio(getTimeLeft(isoMinutesFromNow(180), NOW))).toBe(0);
    expect(getUrgencyRatio(getTimeLeft(isoMinutesFromNow(400), NOW))).toBe(0);
  });

  it("rises smoothly as the deadline approaches", () => {
    const farRatio = getUrgencyRatio(getTimeLeft(isoMinutesFromNow(150), NOW));
    const nearRatio = getUrgencyRatio(getTimeLeft(isoMinutesFromNow(30), NOW));
    expect(nearRatio).toBeGreaterThan(farRatio);
    expect(farRatio).toBeCloseTo(30 / 180, 5);
    expect(nearRatio).toBeCloseTo(150 / 180, 5);
  });
});
