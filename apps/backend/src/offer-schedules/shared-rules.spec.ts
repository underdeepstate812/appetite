import {
  DiscountMode,
  OfferCategory,
  addDays,
  bestBeforeFor,
  currentDiscountPercent,
  discountSteps,
  dueOccurrences,
  isBreakfastOffer,
  isBreakfastTime,
  isDateString,
  nextDiscountStep,
  occurrenceOn,
  upcomingOccurrences,
  validateScheduleTiming,
  windowMinutes,
  zonedParts,
  zonedTimeToUtc,
  type ScheduleTiming,
} from "@apetite/shared";

const MSK = "Europe/Moscow";
/** Момент по московским часам: «2026-10-19 07:30» → UTC. */
const msk = (date: string, time: string) => zonedTimeToUtc(date, time, MSK).getTime();

const weekdays: ScheduleTiming = { daysOfWeek: [1, 2, 3, 4, 5], pickupStartTime: "07:00", pickupEndTime: "10:00", publishLeadMinutes: 180, timezone: MSK, skipDates: [], isActive: true };

describe("time zones", () => {
  it("reads calendar parts in the zone (Moscow is UTC+3), with ISO weekday", () => {
    const p = zonedParts(Date.UTC(2026, 9, 18, 21, 41), MSK); // 18.10 21:41Z = 19.10 00:41 МСК, понедельник
    expect([p.date, p.hour, p.minute, p.weekday, p.minuteOfDay]).toEqual(["2026-10-19", 0, 41, 1, 41]);
    expect(zonedParts(Date.UTC(2026, 9, 18, 12), MSK).weekday).toBe(7); // воскресенье
  });

  it("turns wall-clock time into the right instant", () => {
    expect(zonedTimeToUtc("2026-10-19", "07:00", MSK).toISOString()).toBe("2026-10-19T04:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-19", "00:00", MSK).toISOString()).toBe("2026-10-18T21:00:00.000Z");
  });

  it("survives daylight saving: a non-existent hour moves forward, a repeated hour is taken once (the first)", () => {
    expect(zonedTimeToUtc("2026-03-08", "02:30", "America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(zonedTimeToUtc("2026-11-01", "01:30", "America/New_York").toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("adds days on the calendar, across month and leap boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("recognises only real dates", () => {
    expect(isDateString("2026-02-29")).toBe(false);
    expect(isDateString("2028-02-29")).toBe(true);
    expect(isDateString("2026-1-1")).toBe(false);
  });
});

describe("occurrenceOn", () => {
  it("exists only on the chosen weekdays (19.10.2026 is a Monday)", () => {
    expect(occurrenceOn(weekdays, "2026-10-19")?.pickupStart.toISOString()).toBe("2026-10-19T04:00:00.000Z");
    expect(occurrenceOn(weekdays, "2026-10-24")).toBeNull(); // суббота
  });

  it("publishes `lead` minutes before the start", () => {
    expect(occurrenceOn(weekdays, "2026-10-19")?.publishAt.toISOString()).toBe("2026-10-19T01:00:00.000Z");
  });

  it("a window that ends at or before its start ends the next day", () => {
    const night: ScheduleTiming = { ...weekdays, pickupStartTime: "22:00", pickupEndTime: "02:00" };
    const o = occurrenceOn(night, "2026-10-19")!;
    expect(o.pickupEnd.getTime() - o.pickupStart.getTime()).toBe(4 * 3_600_000);
    expect(windowMinutes("22:00", "02:00")).toBe(240);
    expect(windowMinutes("09:00", "09:00")).toBe(24 * 60);
  });

  it("respects startsOn/endsOn (inclusive) and marks skipped dates", () => {
    const ranged = { ...weekdays, startsOn: "2026-10-20", endsOn: "2026-10-21", skipDates: ["2026-10-21"] };
    expect(occurrenceOn(ranged, "2026-10-19")).toBeNull();
    expect(occurrenceOn(ranged, "2026-10-20")?.skipped).toBe(false);
    expect(occurrenceOn(ranged, "2026-10-21")?.skipped).toBe(true);
    expect(occurrenceOn(ranged, "2026-10-22")).toBeNull();
  });
});

describe("dueOccurrences", () => {
  it("is not due before the publish time, is due at it and until the window closes", () => {
    expect(dueOccurrences(weekdays, msk("2026-10-19", "03:59"))).toHaveLength(0);
    expect(dueOccurrences(weekdays, msk("2026-10-19", "04:00"))).toHaveLength(1);
    expect(dueOccurrences(weekdays, msk("2026-10-19", "08:00"))).toHaveLength(1);
  });

  it("catches up a slept-through publication only while enough of the window is left", () => {
    expect(dueOccurrences(weekdays, msk("2026-10-19", "09:35"))).toHaveLength(1);
    expect(dueOccurrences(weekdays, msk("2026-10-19", "09:45"))).toHaveLength(0); // осталось 15 мин < 20
    expect(dueOccurrences(weekdays, msk("2026-10-19", "10:30"))).toHaveLength(0);
  });

  it("does nothing when paused, on skipped dates and on other weekdays", () => {
    const now = msk("2026-10-19", "06:00");
    expect(dueOccurrences({ ...weekdays, isActive: false }, now)).toHaveLength(0);
    expect(dueOccurrences({ ...weekdays, skipDates: ["2026-10-19"] }, now)).toHaveLength(0);
    expect(dueOccurrences(weekdays, msk("2026-10-24", "06:00"))).toHaveLength(0);
  });

  it("publishes tomorrow's morning offer the evening before when the lead reaches back that far", () => {
    const early = { ...weekdays, publishLeadMinutes: 12 * 60 }; // 07:00 − 12 ч = 19:00 накануне
    expect(dueOccurrences(early, msk("2026-10-19", "18:59"))).toHaveLength(0); // понедельник вечером — вторник ещё не пора
    expect(dueOccurrences(early, msk("2026-10-19", "19:00")).map((o) => o.date)).toContain("2026-10-20");
  });

  it("an overnight window created on day D is still the same occurrence the next morning (one offer per date)", () => {
    const night: ScheduleTiming = { ...weekdays, daysOfWeek: [1], pickupStartTime: "22:00", pickupEndTime: "02:00", publishLeadMinutes: 60 };
    const dates = dueOccurrences(night, msk("2026-10-20", "00:30")).map((o) => o.date);
    expect(dates).toEqual(["2026-10-19"]);
  });
});

describe("upcomingOccurrences", () => {
  it("lists the next N not-yet-finished occurrences, skipped ones flagged", () => {
    const list = upcomingOccurrences({ ...weekdays, skipDates: ["2026-10-20"] }, msk("2026-10-19", "11:00"), 4);
    expect(list.map((o) => o.date)).toEqual(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
    expect(list[0].skipped).toBe(true);
  });

  it("includes today's occurrence while its window is still open", () => {
    expect(upcomingOccurrences(weekdays, msk("2026-10-19", "08:00"), 1)[0].date).toBe("2026-10-19");
  });

  it("returns nothing for a schedule that ended", () => {
    expect(upcomingOccurrences({ ...weekdays, endsOn: "2026-10-01" }, msk("2026-10-19", "08:00"), 3)).toEqual([]);
  });
});

describe("validateScheduleTiming", () => {
  it("accepts a good schedule", () => expect(validateScheduleTiming(weekdays)).toBeNull());
  it.each([
    [{ daysOfWeek: [] }, /хотя бы один день/],
    [{ daysOfWeek: [1, 1] }, /без повторов/],
    [{ daysOfWeek: [0] }, /от 1/],
    [{ pickupStartTime: "7:00" }, /ЧЧ:ММ/],
    [{ pickupStartTime: "09:50", pickupEndTime: "10:00" }, /не короче/],
    [{ pickupStartTime: "06:00", pickupEndTime: "23:00" }, /не длиннее/],
    [{ pickupStartTime: "08:00", pickupEndTime: "20:30" }, /не длиннее 12/],
    [{ publishLeadMinutes: 1440 }, /не больше 24 часов/], // 3 ч окно + 24 ч заранее = оффер живёт больше суток
    [{ publishLeadMinutes: -1 }, /от 0 минут/],
    [{ publishLeadMinutes: 1441 }, /от 0 минут/],
    [{ timezone: "Mars/Olympus" }, /часовой пояс/],
    [{ startsOn: "2026-13-01" }, /начала/],
    [{ startsOn: "2026-10-10", endsOn: "2026-10-01" }, /раньше/],
    [{ skipDates: ["nope"] }, /Пропуски/],
  ])("rejects %j", (patch, message) => {
    expect(validateScheduleTiming({ ...weekdays, ...patch })).toMatch(message);
  });
});

describe("breakfast", () => {
  it("the tab lives before 10:00 Moscow time, boundary excluded", () => {
    expect(isBreakfastTime(msk("2026-10-19", "00:00"))).toBe(true);
    expect(isBreakfastTime(msk("2026-10-19", "09:59"))).toBe(true);
    expect(isBreakfastTime(msk("2026-10-19", "10:00"))).toBe(false);
    expect(isBreakfastTime(msk("2026-10-19", "15:00"))).toBe(false);
  });

  it("an offer is breakfast when its window closes today by 10:00 (inclusive) and has not closed yet", () => {
    const now = msk("2026-10-19", "06:30");
    expect(isBreakfastOffer({ pickupEnd: new Date(msk("2026-10-19", "10:00")).toISOString() }, now)).toBe(true);
    expect(isBreakfastOffer({ pickupEnd: new Date(msk("2026-10-19", "10:01")).toISOString() }, now)).toBe(false);
    expect(isBreakfastOffer({ pickupEnd: new Date(msk("2026-10-19", "09:00")).toISOString() }, now)).toBe(true);
  });

  it("not breakfast: already closed, a window that ends tomorrow, or one that runs past 10", () => {
    const now = msk("2026-10-19", "06:30");
    expect(isBreakfastOffer({ pickupEnd: new Date(msk("2026-10-19", "06:00")).toISOString() }, now)).toBe(false);
    expect(isBreakfastOffer({ pickupEnd: new Date(msk("2026-10-20", "09:00")).toISOString() }, now)).toBe(false);
    expect(isBreakfastOffer({ pickupEnd: new Date(msk("2026-10-19", "12:00")).toISOString() }, now)).toBe(false);
  });

  it("an overnight window that closes this morning counts, before midnight it does not (it ends tomorrow)", () => {
    const end = new Date(msk("2026-10-20", "09:30")).toISOString();
    expect(isBreakfastOffer({ pickupEnd: end }, msk("2026-10-20", "01:00"))).toBe(true);
    expect(isBreakfastOffer({ pickupEnd: end }, msk("2026-10-19", "23:00"))).toBe(false);
  });
});

describe("discount modes", () => {
  it("FIXED never moves; DYNAMIC grows to the cap", () => {
    for (const hours of [5, 1.5, 0.5]) expect(currentDiscountPercent(DiscountMode.FIXED, 40, hours)).toBe(40);
    expect([5, 1.5, 0.5].map((h) => currentDiscountPercent(DiscountMode.DYNAMIC, 40, h))).toEqual([40, 50, 60]);
    expect(currentDiscountPercent(DiscountMode.DYNAMIC, 65, 0.5)).toBe(70);
    expect(currentDiscountPercent(undefined, 40, 0.5)).toBe(60); // старые офферы — динамические
  });

  it("lists the steps without the ones that add nothing (already at the cap)", () => {
    expect(discountSteps(DiscountMode.DYNAMIC, 50).map((s) => s.percent)).toEqual([50, 60, 70]);
    expect(discountSteps(DiscountMode.DYNAMIC, 65).map((s) => s.percent)).toEqual([65, 70]);
    expect(discountSteps(DiscountMode.DYNAMIC, 70).map((s) => s.percent)).toEqual([70]);
    expect(discountSteps(DiscountMode.FIXED, 50).map((s) => s.percent)).toEqual([50]);
  });

  it("tells when the next growth happens, or null", () => {
    const end = new Date(Date.UTC(2026, 9, 19, 12)).toISOString();
    const now = Date.UTC(2026, 9, 19, 8);
    expect(nextDiscountStep(DiscountMode.DYNAMIC, 50, end, now)).toEqual({ percent: 60, at: new Date(Date.UTC(2026, 9, 19, 10)) });
    expect(nextDiscountStep(DiscountMode.DYNAMIC, 50, end, Date.UTC(2026, 9, 19, 10, 30))?.percent).toBe(70);
    expect(nextDiscountStep(DiscountMode.DYNAMIC, 50, end, Date.UTC(2026, 9, 19, 11, 30))).toBeNull();
    expect(nextDiscountStep(DiscountMode.FIXED, 50, end, now)).toBeNull();
    expect(nextDiscountStep(DiscountMode.DYNAMIC, 70, end, now)).toBeNull();
  });
});

describe("bestBeforeFor", () => {
  it("is the end of pickup plus the template's hours", () => {
    const end = new Date("2026-10-19T07:00:00Z");
    expect(bestBeforeFor(end, 6, OfferCategory.BAKERY)?.toISOString()).toBe("2026-10-19T13:00:00.000Z");
    expect(bestBeforeFor(end, null, OfferCategory.FLOWERS)).toBeNull();
  });
});
