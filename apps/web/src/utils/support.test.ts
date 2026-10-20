import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL, buildMailto, buildSupportMailto } from "./support";

describe("письмо в поддержку", () => {
  it("кодирует пробелы как %20, а не «+»", () => {
    expect(buildMailto("a@b.ru", "Тема письма", "строка 1\nстрока 2")).toBe(`mailto:a@b.ru?subject=${encodeURIComponent("Тема письма")}&body=${encodeURIComponent("строка 1\nстрока 2")}`);
    expect(buildMailto("a@b.ru", "a b", "")).not.toContain("+");
  });
  it("тема выбрана и попадает в письмо вместе с данными аккаунта", () => {
    const url = buildSupportMailto("payment", { id: "u-1", name: "Анна", email: "anna@example.ru" });
    expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?`)).toBe(true);
    const subject = decodeURIComponent(url.match(/subject=([^&]+)/)![1]);
    const body = decodeURIComponent(url.match(/body=(.*)$/)![1]);
    expect(subject).toBe("Appetite: Оплата");
    expect(body).toContain("Анна (anna@example.ru)");
    expect(body).toContain("ID: u-1");
  });
});
