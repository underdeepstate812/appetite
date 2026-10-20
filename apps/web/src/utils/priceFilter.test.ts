import { describe, expect, it } from "vitest";
import { MAX_PRICE_RUB, checkPriceRange, describePriceRange, formatPriceRub, parsePriceInput, type PriceLimits } from "./priceFilter";

describe("parsePriceInput", () => {
  it("empty means 'no bound' and is not an error", () => {
    expect(parsePriceInput("")).toEqual({ value: null, error: null, fix: null });
    expect(parsePriceInput("   ")).toEqual({ value: null, error: null, fix: null });
  });

  it("accepts whole roubles, with stray spaces and thousand separators", () => {
    expect(parsePriceInput("350").value).toBe(350);
    expect(parsePriceInput(" 350 ").value).toBe(350);
    expect(parsePriceInput("1 200").value).toBe(1200);
    expect(parsePriceInput("1 200").value).toBe(1200);
    expect(parsePriceInput("0").value).toBe(0);
    expect(parsePriceInput("007").value).toBe(7);
  });

  it("rejects negatives, decimals and letters — each with its own plain message", () => {
    expect(parsePriceInput("-5").error).toMatch(/отрицательной/);
    expect(parsePriceInput("1,5").error).toMatch(/целые рубли/);
    expect(parsePriceInput("12.50").error).toMatch(/целые рубли/);
    expect(parsePriceInput("12abc").error).toMatch(/без букв/);
    expect(parsePriceInput("abc").error).toMatch(/без букв/);
    expect(parsePriceInput("1e3").error).toMatch(/без букв/);
    expect(parsePriceInput("+5").error).toMatch(/без букв/);
    expect(parsePriceInput("₽500").error).toMatch(/без букв/);
  });

  it("caps at a sane maximum", () => {
    expect(parsePriceInput(String(MAX_PRICE_RUB)).error).toBeNull();
    expect(parsePriceInput(String(MAX_PRICE_RUB + 1)).error).toMatch(/Не больше 100 000 ₽/);
    expect(parsePriceInput("99999999999999999999").error).toMatch(/Не больше/);
  });

  it("never returns a value together with an error", () => {
    for (const text of ["-1", "1,5", "x", "100001"]) {
      const result = parsePriceInput(text);
      expect(result.value).toBeNull();
      expect(result.error).not.toBeNull();
    }
  });
});

describe("checkPriceRange", () => {
  it("both empty, only one side, or a proper range are all valid", () => {
    expect(checkPriceRange("", "").valid).toBe(true);
    expect(checkPriceRange("100", "").valid).toBe(true);
    expect(checkPriceRange("", "500").valid).toBe(true);
    expect(checkPriceRange("100", "500").valid).toBe(true);
    expect(checkPriceRange("500", "500").valid).toBe(true); // ровно одна цена — осмысленно
    expect(checkPriceRange("0", "500").valid).toBe(true);
  });

  it("'from' above 'to' is a range error, not a field error", () => {
    const check = checkPriceRange("900", "300");
    expect(check.valid).toBe(false);
    expect(check.rangeError).toMatch(/«От» не может быть больше «до»/);
    expect(check.min.error).toBeNull();
    expect(check.max.error).toBeNull();
  });

  it("'to' = 0 can match nothing, so it is rejected", () => {
    const check = checkPriceRange("", "0");
    expect(check.valid).toBe(false);
    expect(check.max.error).toMatch(/больше нуля/);
    expect(check.max.value).toBeNull();
  });

  it("reports the broken field and keeps the other one's value", () => {
    const check = checkPriceRange("100", "5x");
    expect(check.valid).toBe(false);
    expect(check.min.value).toBe(100);
    expect(check.max.error).toMatch(/без букв/);
    const both = checkPriceRange("-1", "1,5");
    expect(both.min.error).toMatch(/отрицательной/);
    expect(both.max.error).toMatch(/целые рубли/);
  });

  it("does not compare a range when one side is already broken", () => {
    expect(checkPriceRange("900", "x").rangeError).toBeNull();
  });
});

describe("formatting", () => {
  it("formats roubles and describes a range", () => {
    expect(formatPriceRub(1200)).toBe("1 200 ₽");
    expect(describePriceRange(100, 500)).toBe("100–500 ₽");
    expect(describePriceRange(100, null)).toBe("от 100 ₽");
    expect(describePriceRange(null, 500)).toBe("до 500 ₽");
    expect(describePriceRange(null, null)).toBe("");
  });
});

/** Границы цен реальных предложений: ниже минимума и выше максимума выбрать нельзя. */
describe("price limits (the real min/max of the offers)", () => {
  const limits: PriceLimits = { min: 77, max: 935, scope: "на витрине" };

  it("accepts anything inside the limits, bounds INCLUSIVE", () => {
    for (const text of ["77", "78", "500", "934", "935"]) expect(parsePriceInput(text, limits)).toEqual({ value: Number(text), error: null, fix: null });
  });

  it("rejects a price below the cheapest offer and offers the cheapest price as the fix", () => {
    for (const text of ["0", "1", "50", "76"]) {
      const bound = parsePriceInput(text, limits);
      expect(bound.value).toBeNull();
      expect(bound.error).toBe("Минимальная цена на витрине — 77 ₽");
      expect(bound.fix).toBe(77);
    }
  });

  it("rejects a price above the most expensive offer and offers the dearest price as the fix", () => {
    for (const text of ["936", "1000", "99999"]) {
      const bound = parsePriceInput(text, limits);
      expect(bound.value).toBeNull();
      expect(bound.error).toBe("Максимальная цена на витрине — 935 ₽");
      expect(bound.fix).toBe(935);
    }
  });

  it("names the scope: 'in the category' when a category is picked", () => {
    expect(parsePriceInput("10", { min: 189, max: 935, scope: "в категории «Цветы»" }).error).toBe("Минимальная цена в категории «Цветы» — 189 ₽");
    expect(parsePriceInput("2000", { min: 189, max: 935, scope: "в категории «Цветы»" }).error).toBe("Максимальная цена в категории «Цветы» — 935 ₽");
  });

  it("uses 'на витрине' when no scope is given", () => {
    expect(parsePriceInput("1", { min: 77, max: 935 }).error).toMatch(/на витрине/);
  });

  it("format errors win over limit errors (letters are letters, whatever the number)", () => {
    expect(parsePriceInput("1x", limits).error).toMatch(/без букв/);
    expect(parsePriceInput("-5", limits).error).toMatch(/отрицательной/);
    expect(parsePriceInput("1,5", limits).error).toMatch(/целые рубли/);
    expect(parsePriceInput("1x", limits).fix).toBeNull();
  });

  it("with limits the real maximum replaces the generic 100 000 cap; without limits the cap stays", () => {
    expect(parsePriceInput("100001", limits).error).toMatch(/Максимальная цена на витрине — 935 ₽/);
    expect(parsePriceInput("100001").error).toMatch(/Не больше 100 000 ₽/);
    expect(parsePriceInput("100001").fix).toBeNull();
  });

  it("a market with a single price accepts only that price", () => {
    const single: PriceLimits = { min: 150, max: 150 };
    expect(parsePriceInput("150", single).error).toBeNull();
    expect(parsePriceInput("149", single).fix).toBe(150);
    expect(parsePriceInput("151", single).fix).toBe(150);
  });

  it("empty is still 'no bound', even with limits", () => {
    expect(parsePriceInput("", limits)).toEqual({ value: null, error: null, fix: null });
  });

  it("checkPriceRange with limits: both fields are checked against them, 'from' above 'to' still caught", () => {
    expect(checkPriceRange("100", "500", limits).valid).toBe(true);
    expect(checkPriceRange("77", "935", limits).valid).toBe(true);
    expect(checkPriceRange("", "", limits).valid).toBe(true);
    const low = checkPriceRange("10", "500", limits);
    expect(low.valid).toBe(false);
    expect(low.min.fix).toBe(77);
    const high = checkPriceRange("100", "5000", limits);
    expect(high.valid).toBe(false);
    expect(high.max.fix).toBe(935);
    const both = checkPriceRange("10", "5000", limits);
    expect([both.min.fix, both.max.fix]).toEqual([77, 935]);
    expect(checkPriceRange("600", "300", limits).rangeError).toMatch(/«От» не может быть больше «до»/);
  });

  it("'до 0' is below the minimum when limits exist (and keeps its own message without them)", () => {
    expect(checkPriceRange("", "0", limits).max.error).toMatch(/Минимальная цена/);
    expect(checkPriceRange("", "0").max.error).toMatch(/больше нуля/);
  });

  it("no range error while a field is already out of limits (one problem at a time)", () => {
    expect(checkPriceRange("5000", "100", limits).rangeError).toBeNull();
  });
});
