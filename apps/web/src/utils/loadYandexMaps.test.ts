import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function freshLoader() {
  vi.resetModules();
  return (await import("./loadYandexMaps")).loadYandexMaps;
}

beforeEach(() => {
  delete window.ymaps3;
  document.head.innerHTML = "";
});
afterEach(() => vi.useRealTimers());

const script = () => document.getElementById("appetite-yandex-maps-api") as HTMLScriptElement | null;

describe("loadYandexMaps", () => {
  it("requests API 3.0 with the encoded key and Russian locale, and resolves after ymaps3.ready", async () => {
    const load = await freshLoader();
    const promise = load("k e/y");
    expect(script()!.src).toBe("https://api-maps.yandex.ru/v3/?apikey=k%20e%2Fy&lang=ru_RU");
    window.ymaps3 = { ready: Promise.resolve() } as never;
    script()!.onload!(new Event("load"));
    await expect(promise).resolves.toBe(window.ymaps3);
  });

  it("injects the script only once for concurrent callers", async () => {
    const load = await freshLoader();
    const a = load("k");
    const b = load("k");
    expect(document.querySelectorAll("#appetite-yandex-maps-api")).toHaveLength(1);
    window.ymaps3 = { ready: Promise.resolve() } as never;
    script()!.onload!(new Event("load"));
    await expect(Promise.all([a, b])).resolves.toHaveLength(2);
  });

  it("rejects and cleans up when the script cannot load (offline / blocked), so a later call retries", async () => {
    const load = await freshLoader();
    const promise = load("k");
    script()!.onerror!(new Event("error"));
    await expect(promise).rejects.toThrow(/Не удалось загрузить/);
    expect(script()).toBeNull();
    const retry = load("k");
    expect(script()).not.toBeNull();
    retry.catch(() => {});
  });

  it("rejects when ymaps3.ready fails (invalid key)", async () => {
    const load = await freshLoader();
    const promise = load("bad");
    window.ymaps3 = { ready: Promise.reject(new Error("auth")) } as never;
    script()!.onload!(new Event("load"));
    await expect(promise).rejects.toThrow(/API-ключ/);
  });

  it("times out instead of hanging forever", async () => {
    vi.useFakeTimers();
    const load = await freshLoader();
    const promise = load("k");
    const assertion = expect(promise).rejects.toThrow(/вовремя/);
    await vi.advanceTimersByTimeAsync(13_000);
    await assertion;
  });
});
