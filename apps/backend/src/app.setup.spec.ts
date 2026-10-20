import { parseTrustProxy } from "./app.setup";

describe("parseTrustProxy", () => {
  it.each([
    ["true", true],
    ["false", false],
    ["1", 1],
    ["2", 2],
    ["loopback", "loopback"],
    ["10.0.0.0/8", "10.0.0.0/8"],
  ])("%p → %p", (input, expected) => {
    expect(parseTrustProxy(input)).toBe(expected);
  });
});
