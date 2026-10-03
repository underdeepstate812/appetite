import { identityTracker } from "./auth-rate-limit";

describe("identityTracker", () => {
  it("различает пары IP + идентификатор", () => {
    const a = identityTracker({ ip: "10.0.0.1", body: { identifier: "a@example.com" } });
    expect(identityTracker({ ip: "10.0.0.1", body: { identifier: "b@example.com" } })).not.toBe(a);
    expect(identityTracker({ ip: "10.0.0.2", body: { identifier: "a@example.com" } })).not.toBe(a);
  });

  it("не различает регистр и пробелы вокруг идентификатора", () => {
    expect(identityTracker({ ip: "10.0.0.1", body: { identifier: "  A@Example.com " } })).toBe(
      identityTracker({ ip: "10.0.0.1", body: { identifier: "a@example.com" } })
    );
  });

  it("берёт identifier, email или phone — по тому, что есть в теле", () => {
    const ip = "10.0.0.1";
    expect(identityTracker({ ip, body: { email: "a@example.com" } })).toContain("a@example.com");
    expect(identityTracker({ ip, body: { phone: "+79991234567" } })).toContain("+79991234567");
  });

  it.each([undefined, {}, { identifier: "" }, { identifier: 123 }, { identifier: { $ne: null } }])(
    "без пригодного идентификатора (%p) откатывается к одному IP",
    (body) => {
      expect(identityTracker({ ip: "10.0.0.1", body })).toBe("10.0.0.1");
    }
  );

  it("длинный идентификатор обрезается, ключ остаётся ограниченным", () => {
    const tracker = identityTracker({ ip: "10.0.0.1", body: { identifier: "x".repeat(10_000) } });
    expect(tracker.length).toBeLessThan(200);
  });
});
