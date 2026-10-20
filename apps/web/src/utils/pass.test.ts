import { describe, expect, it } from "vitest";
import { formatMemberSince, hashString, levelProgressRatio, passBars, passSerial } from "./pass";

describe("пропуск", () => {
  it("номер и штрихи детерминированы: у одного пользователя всегда те же, у разных — разные", () => {
    expect(passSerial("user-1")).toBe(passSerial("user-1"));
    expect(passSerial("user-1")).not.toBe(passSerial("user-2"));
    expect(passSerial("user-1")).toMatch(/^\d{3} \d{3}$/);
    expect(passBars("user-1")).toEqual(passBars("user-1"));
    expect(passBars("user-1")).toHaveLength(42);
    expect(passBars("user-1").every((w) => w >= 1 && w <= 3)).toBe(true);
    const h = hashString("x");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  });

  it("прогресс до следующего уровня: доля пути, на высшем уровне — полный круг, не выходит за 0…1", () => {
    expect(levelProgressRatio(25, { minPoints: 0 }, { minPoints: 50 })).toBe(0.5);
    expect(levelProgressRatio(63, { minPoints: 50 }, { minPoints: 200 })).toBeCloseTo(13 / 150);
    expect(levelProgressRatio(999, { minPoints: 500 }, null)).toBe(1);
    expect(levelProgressRatio(-5, { minPoints: 0 }, { minPoints: 50 })).toBe(0);
    expect(levelProgressRatio(500, { minPoints: 0 }, { minPoints: 50 })).toBe(1);
  });

  it("«С нами с октября 2026»: месяц в родительном падеже, не «октябрь»", () => {
    expect(formatMemberSince("2026-10-06T10:00:00Z")).toBe("октября 2026");
    expect(formatMemberSince("nope")).toBe("");
  });
});
