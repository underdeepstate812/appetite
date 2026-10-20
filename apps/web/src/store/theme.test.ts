import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockMatchMedia(dark: boolean) {
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never;
}

describe("тема оформления", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    vi.resetModules();
  });
  afterEach(() => vi.restoreAllMocks());

  it("по умолчанию — системная: тёмная система → data-theme=dark, светлая → light", async () => {
    mockMatchMedia(true);
    let theme = await import("./theme");
    theme.themeActions.init();
    expect(document.documentElement.dataset.theme).toBe("dark");
    vi.resetModules();
    mockMatchMedia(false);
    theme = await import("./theme");
    theme.themeActions.init();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("явный выбор побеждает систему и запоминается; «Системная» стирает выбор", async () => {
    mockMatchMedia(false);
    const theme = await import("./theme");
    theme.themeActions.init();
    theme.themeActions.set("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("apetite.web.theme")).toBe("dark");
    theme.themeActions.set("system");
    expect(localStorage.getItem("apetite.web.theme")).toBeNull();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("сохранённый выбор читается при старте", async () => {
    localStorage.setItem("apetite.web.theme", "dark");
    mockMatchMedia(false);
    const theme = await import("./theme");
    theme.themeActions.init();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("мусор в хранилище трактуется как «Системная»", async () => {
    localStorage.setItem("apetite.web.theme", "purple");
    mockMatchMedia(false);
    const theme = await import("./theme");
    expect(theme.resolveTheme("system")).toBe("light");
    theme.themeActions.init();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
