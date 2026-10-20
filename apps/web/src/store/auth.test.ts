import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../api/client";
import { __resetAuthForTests, authActions } from "./auth";

const USER = { id: "u1", name: "Аня", email: "a@b.ru", role: "USER" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
let current: () => ReturnType<typeof __state>;
function __state() {
  return {
    access: localStorage.getItem("apetite.web.accessToken"),
    refresh: localStorage.getItem("apetite.web.refreshToken"),
  };
}

beforeEach(() => {
  localStorage.clear();
  __resetAuthForTests();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  current = __state;
});
afterEach(() => vi.unstubAllGlobals());

describe("auth store", () => {
  it("login persists tokens and the user", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { user: USER, accessToken: "A1", refreshToken: "R1" }));
    await authActions.login({ identifier: "a@b.ru", password: "x" });
    expect(current()).toEqual({ access: "A1", refresh: "R1" });
    expect(JSON.parse(localStorage.getItem("apetite.web.user")!).name).toBe("Аня");
  });

  it("hydrate drops the session when the server rejects the tokens", async () => {
    localStorage.setItem("apetite.web.accessToken", "old");
    localStorage.setItem("apetite.web.refreshToken", "oldR");
    // /auth/me → 401, затем refresh → 401: сессия мертва.
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401, message: "no" })).mockResolvedValueOnce(json(401, { statusCode: 401, message: "no" }));
    await authActions.hydrate();
    expect(current()).toEqual({ access: null, refresh: null });
  });

  it("hydrate keeps the cached session when the network is down", async () => {
    localStorage.setItem("apetite.web.accessToken", "tok");
    localStorage.setItem("apetite.web.refreshToken", "ref");
    localStorage.setItem("apetite.web.user", JSON.stringify(USER));
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await authActions.hydrate();
    expect(current()).toEqual({ access: "tok", refresh: "ref" });
  });

  it("parallel 401s share ONE refresh (refresh tokens rotate) and are retried with the new token", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { user: USER, accessToken: "A1", refreshToken: "R1" }));
    await authActions.login({ identifier: "a@b.ru", password: "x" });
    fetchMock.mockReset();

    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return json(200, { accessToken: "A2", refreshToken: "R2" });
      }
      return auth === "Bearer A2" ? json(200, { ok: url }) : json(401, { statusCode: 401, message: "expired" });
    });

    const [a, b] = await Promise.all([apiClient.get<{ ok: string }>("/orders"), apiClient.get<{ ok: string }>("/orders/x")]);
    expect(refreshCalls).toBe(1);
    expect(a.ok).toContain("/orders");
    expect(b.ok).toContain("/orders/x");
    expect(current()).toEqual({ access: "A2", refresh: "R2" });
  });

  it("logout clears local state even if the server call fails", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { user: USER, accessToken: "A1", refreshToken: "R1" }));
    await authActions.login({ identifier: "a@b.ru", password: "x" });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await authActions.logout();
    expect(current()).toEqual({ access: null, refresh: null });
  });
});
