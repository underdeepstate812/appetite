import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useBusiness } from "./useBusiness";
import { businessesApi } from "../api/businesses";

jest.mock("../api/businesses", () => ({ businessesApi: { get: jest.fn() } }));
const get = businessesApi.get as jest.Mock;
const BUSINESS = { id: "b1", name: "Shava Point" };

beforeEach(() => jest.clearAllMocks());

describe("useBusiness", () => {
  it("loads the venue", async () => {
    get.mockResolvedValue(BUSINESS);
    const { result } = renderHook(() => useBusiness("b1"));
    expect(result.current.state.status).toBe("loading");
    await waitFor(() => expect(result.current.state).toEqual({ status: "ready", business: BUSINESS }));
    expect(get).toHaveBeenCalledWith("b1");
  });

  it("reports a failure instead of throwing, and recovers on retry", async () => {
    get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(BUSINESS);
    const { result } = renderHook(() => useBusiness("b1"));
    await waitFor(() => expect(result.current.state.status).toBe("failed"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("waits for the id and does not call the API without one", () => {
    const { result } = renderHook(() => useBusiness(undefined));
    expect(result.current.state.status).toBe("loading");
    expect(get).not.toHaveBeenCalled();
  });

  it("refetches when the venue changes", async () => {
    get.mockResolvedValue(BUSINESS);
    const { result, rerender } = renderHook(({ id }: { id: string }) => useBusiness(id), { initialProps: { id: "b1" } });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    rerender({ id: "b2" });
    await waitFor(() => expect(get).toHaveBeenCalledWith("b2"));
  });
});
