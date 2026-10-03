import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_AUTH, getReturnPath } from "./returnPath";

const withFrom = (from: unknown) => ({ state: { from } });

describe("getReturnPath", () => {
  it("returns the page the guest was sent from, with its query string", () => {
    expect(getReturnPath(withFrom({ pathname: "/checkout/abc", search: "?x=1" }))).toBe("/checkout/abc?x=1");
    expect(getReturnPath(withFrom({ pathname: "/orders" }))).toBe("/orders");
  });

  it("falls back to the map when there is no state", () => {
    expect(getReturnPath({ state: null })).toBe(DEFAULT_AFTER_AUTH);
    expect(getReturnPath({ state: {} })).toBe(DEFAULT_AFTER_AUTH);
  });

  it("never redirects to an external or protocol-relative URL (open redirect)", () => {
    expect(getReturnPath(withFrom({ pathname: "https://evil.example" }))).toBe(DEFAULT_AFTER_AUTH);
    expect(getReturnPath(withFrom({ pathname: "//evil.example/x" }))).toBe(DEFAULT_AFTER_AUTH);
  });

  it("does not bounce back into the auth pages", () => {
    expect(getReturnPath(withFrom({ pathname: "/login" }))).toBe(DEFAULT_AFTER_AUTH);
    expect(getReturnPath(withFrom({ pathname: "/register" }))).toBe(DEFAULT_AFTER_AUTH);
  });
});
