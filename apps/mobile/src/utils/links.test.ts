import { Linking, Platform } from "react-native";
import { openMailLink } from "./links";

const URL = "mailto:hello@apetite.ru?subject=Hi";
const original = Platform.OS;
const setOS = (os: string) => Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });

afterEach(() => {
  setOS(original);
  delete (globalThis as { document?: unknown }).document;
  jest.clearAllMocks();
});

describe("openMailLink", () => {
  it("on native hands the link to the system", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await expect(openMailLink(URL)).resolves.toBeUndefined();
    expect(open).toHaveBeenCalledWith(URL);
  });

  it("on native passes a refusal on, so the caller can show the address", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no mail app"));
    await expect(openMailLink(URL)).rejects.toThrow("no mail app");
  });

  it("on web clicks a plain anchor: no window.open, hence no stray blank tab", async () => {
    setOS("web");
    const click = jest.fn();
    const remove = jest.fn();
    const anchor: Record<string, unknown> = { style: {}, click, remove };
    (globalThis as { document?: unknown }).document = { createElement: jest.fn(() => anchor), body: { appendChild: jest.fn() } };
    const open = jest.spyOn(Linking, "openURL");
    await expect(openMailLink(URL)).resolves.toBeUndefined();
    expect(anchor.href).toBe(URL);
    expect(anchor.target).toBeUndefined();
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it("on web reports a click that throws", async () => {
    setOS("web");
    const anchor = { style: {}, click: () => { throw new Error("blocked"); }, remove: jest.fn() };
    (globalThis as { document?: unknown }).document = { createElement: () => anchor, body: { appendChild: jest.fn() } };
    await expect(openMailLink(URL)).rejects.toThrow("blocked");
  });
});
