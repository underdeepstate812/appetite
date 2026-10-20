import { buildMailto, GENERAL_REASONS, ORDER_REASONS, shortOrderNumber, SUPPORT_EMAIL } from "./support";

describe("shortOrderNumber", () => {
  it("is the last six characters, upper-cased, so it can be read out loud", () => {
    expect(shortOrderNumber("cm1x9k2ab00004hq7z3d5f9a2b")).toBe("5F9A2B");
  });

  it("does not break on a short id", () => {
    expect(shortOrderNumber("ab12")).toBe("AB12");
  });
});

describe("buildMailto", () => {
  const url = buildMailto(SUPPORT_EMAIL, "Appetite: помощь с заказом №5F9A2B", "Здравствуйте!\n\nСумма: 240 ₽ + доставка & ещё");

  it("addresses the support mailbox", () => {
    expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`)).toBe(true);
  });

  it("encodes spaces as %20 (a '+' would show up literally in mail apps) and keeps line breaks", () => {
    expect(url).not.toContain("+" + "помощь");
    expect(url).toContain("%20");
    expect(url).toContain("%0A%0A");
  });

  it("escapes characters that would cut the link: & and + inside the body", () => {
    const body = url.split("&body=")[1];
    expect(body).toContain("%26");
    expect(body).toContain("%2B");
    expect(body).not.toMatch(/[&+ ]/);
  });

  it("round-trips: the mail client decodes exactly what was written", () => {
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("subject")).toBe("Appetite: помощь с заказом №5F9A2B");
    expect(params.get("body")).toBe("Здравствуйте!\n\nСумма: 240 ₽ + доставка & ещё");
  });
});

describe("support reasons", () => {
  it("offers 'cancel' only for a concrete order (that is where it makes sense) and always ends with 'other'", () => {
    expect(ORDER_REASONS).toContain("cancel");
    expect(GENERAL_REASONS).not.toContain("cancel");
    expect(ORDER_REASONS[ORDER_REASONS.length - 1]).toBe("other");
    expect(GENERAL_REASONS[GENERAL_REASONS.length - 1]).toBe("other");
  });
});
