import { ApiError } from "../api/client";
import { authApi } from "../api/auth";
import { tokenStorage } from "./tokenStorage";
import { useAuthStore } from "./authStore";

jest.mock("../api/auth", () => ({
  authApi: { me: jest.fn(), login: jest.fn(), register: jest.fn(), logout: jest.fn(), refresh: jest.fn() },
}));

const mockMemory = new Map<string, string>();
jest.mock("./tokenStorage", () => ({
  tokenStorage: {
    getItem: jest.fn(async (key: string) => mockMemory.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => void mockMemory.set(key, value)),
    removeItem: jest.fn(async (key: string) => void mockMemory.delete(key)),
  },
}));

const USER = { id: "u1", email: "qa@example.test", name: "QA", role: "USER" } as never;
const me = authApi.me as jest.Mock;

function resetStore() {
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isHydrated: false, isLoading: false, error: null });
}

beforeEach(() => {
  mockMemory.clear();
  jest.clearAllMocks();
  resetStore();
});

describe("authStore.hydrate", () => {
  it("just marks the store hydrated when there are no tokens", async () => {
    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState()).toMatchObject({ isHydrated: true, user: null });
    expect(me).not.toHaveBeenCalled();
  });

  it("restores the user from the server and caches the profile", async () => {
    mockMemory.set("apetite.accessToken", "a");
    mockMemory.set("apetite.refreshToken", "r");
    me.mockResolvedValue(USER);

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().user).toEqual(USER);
    expect(JSON.parse(mockMemory.get("apetite.user") as string)).toEqual(USER);
  });

  it("signs out and wipes tokens and the cache when the server rejects the token (401)", async () => {
    mockMemory.set("apetite.accessToken", "a");
    mockMemory.set("apetite.refreshToken", "r");
    mockMemory.set("apetite.user", JSON.stringify(USER));
    me.mockRejectedValue(new ApiError(401, "expired"));

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState()).toMatchObject({ user: null, accessToken: null, refreshToken: null, isHydrated: true });
    expect([...mockMemory.keys()]).toEqual([]);
  });

  it("keeps the session on a network error and opens the app with the cached profile", async () => {
    mockMemory.set("apetite.accessToken", "a");
    mockMemory.set("apetite.refreshToken", "r");
    mockMemory.set("apetite.user", JSON.stringify(USER));
    me.mockRejectedValue(new ApiError(0, "Нет соединения"));

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().user).toEqual(USER);
    expect(mockMemory.get("apetite.accessToken")).toBe("a");
    expect(mockMemory.get("apetite.refreshToken")).toBe("r");
  });

  it("keeps the tokens on a server error (5xx) even without a cached profile", async () => {
    mockMemory.set("apetite.accessToken", "a");
    mockMemory.set("apetite.refreshToken", "r");
    me.mockRejectedValue(new ApiError(503, "unavailable"));

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState()).toMatchObject({ user: null, isHydrated: true });
    expect(mockMemory.get("apetite.refreshToken")).toBe("r");
  });
});

describe("authStore session lifecycle", () => {
  it("caches the profile on login and clears everything on logout", async () => {
    (authApi.login as jest.Mock).mockResolvedValue({ accessToken: "a", refreshToken: "r", user: USER });
    (authApi.logout as jest.Mock).mockResolvedValue({ success: true });

    await useAuthStore.getState().login({ identifier: "x", password: "y" });
    expect(mockMemory.has("apetite.user")).toBe(true);

    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect([...mockMemory.keys()]).toEqual([]);
    expect(tokenStorage.removeItem).toHaveBeenCalled();
  });

  it("updates the cached copy when the profile is edited", () => {
    useAuthStore.getState().setUser({ ...(USER as object), name: "Новое имя" } as never);

    expect(useAuthStore.getState().user?.name).toBe("Новое имя");
  });
});
