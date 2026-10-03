import { ApiError, apiClient, isNetworkError } from "./client";

jest.mock("../i18n", () => ({ __esModule: true, default: { t: (key: string) => key } }));

async function failureOf(call: () => Promise<unknown>): Promise<ApiError> {
  try {
    await call();
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("expected the call to fail");
}

describe("apiClient network failures", () => {
  afterEach(() => jest.restoreAllMocks());

  it("turns a fetch TypeError into a statusCode-0 ApiError with the localized message", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await failureOf(() => apiClient.get("/offers/nearby", { auth: false }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(0);
    expect(error.message).toBe("common.networkError");
    expect(isNetworkError(error)).toBe(true);
  });

  it("does not treat a server error response as a network error", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ statusCode: 500, message: "boom" }), { status: 500 }));

    const error = await failureOf(() => apiClient.get("/orders", { auth: false }));

    expect(error.statusCode).toBe(500);
    expect(isNetworkError(error)).toBe(false);
  });
});
