import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { LOCATE_WATCHDOG_MS, SPB_CENTER, useGeolocation } from "./useGeolocation";

const ME = { lat: 59.95, lng: 30.31 };
const CACHE_KEY = "apetite.web.geo";

type PositionCb = (position: { coords: { latitude: number; longitude: number } }) => void;
type ErrorCb = (error: { code: number; PERMISSION_DENIED: number; POSITION_UNAVAILABLE: number; TIMEOUT: number }) => void;

const ERR = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };

let getCurrentPosition: ReturnType<typeof vi.fn>;
let permission: { state: PermissionState; listeners: Array<() => void>; addEventListener: (t: string, cb: () => void) => void; removeEventListener: (t: string, cb: () => void) => void };

function setNavigator(opts: { geolocation?: boolean; permissionState?: PermissionState | null; secure?: boolean } = {}) {
  const { geolocation = true, permissionState = "prompt", secure = true } = opts;
  getCurrentPosition = vi.fn();
  permission = {
    state: permissionState ?? "prompt",
    listeners: [],
    addEventListener(_t, cb) { this.listeners.push(cb); },
    removeEventListener(_t, cb) { this.listeners = this.listeners.filter((l) => l !== cb); },
  };
  const nav: Record<string, unknown> = {};
  if (geolocation) nav.geolocation = { getCurrentPosition };
  if (permissionState !== null) nav.permissions = { query: vi.fn().mockResolvedValue(permission) };
  vi.stubGlobal("navigator", nav);
  vi.stubGlobal("isSecureContext", secure);
  Object.defineProperty(window, "isSecureContext", { value: secure, configurable: true });
}

const succeed = (coords = ME) => getCurrentPosition.mockImplementation((ok: PositionCb) => ok({ coords: { latitude: coords.lat, longitude: coords.lng } }));
const fail = (code: number) => getCurrentPosition.mockImplementation((_ok: PositionCb, err: ErrorCb) => err({ code, ...ERR }));

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
});

describe("useGeolocation", () => {
  it("does NOT ask the browser on mount: the city centre first, the dialog only on the user's action", async () => {
    setNavigator();
    const { result } = renderHook(() => useGeolocation());
    await act(async () => {});
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.location).toEqual({ ...SPB_CENTER, isFallback: true });
  });

  it("locate() → locating → granted with the real position, remembered for the tab session", async () => {
    setNavigator();
    succeed();
    const { result } = renderHook(() => useGeolocation());
    await act(async () => {});
    act(() => result.current.locate());
    expect(result.current.status).toBe("granted");
    expect(result.current.location).toEqual({ ...ME, isFallback: false });
    expect(JSON.parse(sessionStorage.getItem(CACHE_KEY)!)).toMatchObject(ME);
  });

  it("shows 'locating' while the browser is thinking", async () => {
    setNavigator();
    getCurrentPosition.mockImplementation(() => {});
    const { result } = renderHook(() => useGeolocation());
    await act(async () => {});
    act(() => result.current.locate());
    expect(result.current.status).toBe("locating");
  });

  it("never hangs on 'locating': an unanswered browser dialog turns into 'timeout', and a late answer still wins", async () => {
    vi.useFakeTimers();
    try {
      setNavigator();
      let answer: PositionCb | null = null;
      getCurrentPosition.mockImplementation((ok: PositionCb) => {
        answer = ok;
      });
      const { result } = renderHook(() => useGeolocation());
      await act(async () => {});
      act(() => result.current.locate());
      expect(result.current.status).toBe("locating");
      act(() => void vi.advanceTimersByTime(LOCATE_WATCHDOG_MS + 10));
      expect(result.current.status).toBe("timeout");
      act(() => answer?.({ coords: { latitude: ME.lat, longitude: ME.lng } }));
      expect(result.current.status).toBe("granted");
      expect(result.current.location).toEqual({ ...ME, isFallback: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("a quick answer cancels the watchdog (no late 'timeout' over a granted position)", async () => {
    vi.useFakeTimers();
    try {
      setNavigator();
      succeed();
      const { result } = renderHook(() => useGeolocation());
      await act(async () => {});
      act(() => result.current.locate());
      act(() => void vi.advanceTimersByTime(LOCATE_WATCHDOG_MS * 2));
      expect(result.current.status).toBe("granted");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [ERR.PERMISSION_DENIED, "denied"],
    [ERR.TIMEOUT, "timeout"],
    [ERR.POSITION_UNAVAILABLE, "unavailable"],
  ])("a failed request (code %i) → %s, and the city stays", async (code, status) => {
    setNavigator();
    fail(code);
    const { result } = renderHook(() => useGeolocation());
    await act(async () => {});
    act(() => result.current.locate());
    expect(result.current.status).toBe(status);
    expect(result.current.location.isFallback).toBe(true);
  });

  it("without the Geolocation API → unavailable, and no request is attempted", async () => {
    setNavigator({ geolocation: false, permissionState: null });
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe("unavailable");
    act(() => result.current.locate());
    expect(result.current.status).toBe("unavailable");
  });

  it("on an insecure page (plain http, not localhost) says so instead of the misleading 'denied'", async () => {
    setNavigator({ secure: false });
    const { result } = renderHook(() => useGeolocation());
    await act(async () => {});
    expect(result.current.status).toBe("insecure");
    act(() => result.current.locate());
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(result.current.status).toBe("insecure");
  });

  it("permission already granted → takes the position by itself, no button needed", async () => {
    setNavigator({ permissionState: "granted" });
    succeed();
    const { result } = renderHook(() => useGeolocation());
    await waitFor(() => expect(result.current.status).toBe("granted"));
    expect(result.current.location).toEqual({ ...ME, isFallback: false });
  });

  it("permission already denied → 'denied' right away, with the city and without a pointless request", async () => {
    setNavigator({ permissionState: "denied" });
    const { result } = renderHook(() => useGeolocation());
    await waitFor(() => expect(result.current.status).toBe("denied"));
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("restores a fresh remembered position at once (no flash of the city) and refreshes it quietly", async () => {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...ME, at: Date.now() - 60_000 }));
    setNavigator({ permissionState: "granted" });
    const fresh = { lat: 59.96, lng: 30.32 };
    succeed(fresh);
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe("granted");
    expect(result.current.location).toEqual({ ...ME, isFallback: false });
    await waitFor(() => expect(result.current.location.lat).toBe(fresh.lat));
    expect(result.current.status).toBe("granted"); // ни разу не «Определяем…»
  });

  it("ignores a stale remembered position (older than 30 min)", () => {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...ME, at: Date.now() - 31 * 60_000 }));
    setNavigator();
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe("idle");
    expect(result.current.location.isFallback).toBe(true);
  });

  it("a remembered position is dropped when the browser says the permission is gone", async () => {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...ME, at: Date.now() }));
    setNavigator({ permissionState: "prompt" });
    const { result } = renderHook(() => useGeolocation());
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.location.isFallback).toBe(true);
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it("reacts when the user flips the permission in the browser's site settings", async () => {
    setNavigator({ permissionState: "denied" });
    succeed();
    const { result } = renderHook(() => useGeolocation());
    await waitFor(() => expect(result.current.status).toBe("denied"));
    permission.state = "granted";
    act(() => permission.listeners.forEach((cb) => cb()));
    await waitFor(() => expect(result.current.status).toBe("granted"));
    permission.state = "denied";
    act(() => permission.listeners.forEach((cb) => cb()));
    expect(result.current.status).toBe("denied");
    expect(result.current.location.isFallback).toBe(true);
  });

  it("reset() ('весь город') forgets the position but leaves the browser permission alone", async () => {
    setNavigator();
    succeed();
    const { result } = renderHook(() => useGeolocation());
    await act(async () => {});
    act(() => result.current.locate());
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(result.current.location).toEqual({ ...SPB_CENTER, isFallback: true });
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it("stops listening to the permission on unmount", async () => {
    setNavigator();
    const { unmount } = renderHook(() => useGeolocation());
    await act(async () => {});
    expect(permission.listeners).toHaveLength(1);
    unmount();
    expect(permission.listeners).toHaveLength(0);
  });
});
