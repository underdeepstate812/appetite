import { renderHook, waitFor } from "@testing-library/react-native";
import { clearOrderLabelCache, useOrderLabels } from "./useOrderLabels";
import { offersApi } from "../api/offers";
import { businessesApi } from "../api/businesses";

jest.mock("../api/offers", () => ({ offersApi: { get: jest.fn() } }));
jest.mock("../api/businesses", () => ({ businessesApi: { get: jest.fn() } }));
const getOffer = offersApi.get as jest.Mock;
const getBusiness = businessesApi.get as jest.Mock;

const order = (id: string, offerId: string, businessId: string) => ({ id, offerId, businessId }) as never;
const A = order("1", "o1", "b1");
const B = order("2", "o2", "b1");

beforeEach(() => {
  jest.clearAllMocks();
  clearOrderLabelCache();
  getOffer.mockImplementation(async (id: string) => ({ id, title: `Оффер ${id}` }));
  getBusiness.mockImplementation(async (id: string) => ({ id, name: `Заведение ${id}` }));
});

describe("useOrderLabels", () => {
  it("resolves the offer title and venue name for each order", async () => {
    const { result } = renderHook(() => useOrderLabels([A, B]));
    await waitFor(() => expect(result.current.pending).toBe(false));
    await waitFor(() => expect(result.current.titleOf(A)).toBe("Оффер o1"));
    expect(result.current.titleOf(B)).toBe("Оффер o2");
    expect(result.current.venueOf(A)).toBe("Заведение b1");
  });

  it("asks once per offer and per venue, even when orders repeat them", async () => {
    const { result } = renderHook(() => useOrderLabels([A, order("3", "o1", "b1"), B]));
    await waitFor(() => expect(result.current.titleOf(B)).toBe("Оффер o2"));
    expect(getOffer).toHaveBeenCalledTimes(2);
    expect(getBusiness).toHaveBeenCalledTimes(1);
  });

  it("does nothing until the orders arrive", () => {
    renderHook(() => useOrderLabels(null));
    expect(getOffer).not.toHaveBeenCalled();
  });

  it("does not refetch what it already knows when the list reloads", async () => {
    const { result, rerender } = renderHook(({ orders }: { orders: never[] }) => useOrderLabels(orders), { initialProps: { orders: [A] as never[] } });
    await waitFor(() => expect(result.current.titleOf(A)).toBe("Оффер o1"));
    rerender({ orders: [A] as never[] });
    expect(getOffer).toHaveBeenCalledTimes(1);
    expect(result.current.titleOf(A)).toBe("Оффер o1");
  });

  it("survives a failed lookup: that row stays unlabelled, the others are fine, and it retries later", async () => {
    getOffer.mockImplementation(async (id: string) => {
      if (id === "o1") throw new Error("offline");
      return { id, title: `Оффер ${id}` };
    });
    const { result, rerender } = renderHook(({ orders }: { orders: never[] }) => useOrderLabels(orders), { initialProps: { orders: [A, B] as never[] } });
    await waitFor(() => expect(result.current.titleOf(B)).toBe("Оффер o2"));
    expect(result.current.titleOf(A)).toBeUndefined();
    expect(result.current.pending).toBe(false);

    getOffer.mockImplementation(async (id: string) => ({ id, title: `Оффер ${id}` }));
    rerender({ orders: [A, B] as never[] });
    // новый массив того же содержимого — новая загрузка списка: пропущенное название подтягивается
    await waitFor(() => expect(result.current.titleOf(A)).toBe("Оффер o1"));
  });

  it("caps lookups so a long history cannot flood the API", async () => {
    const many = Array.from({ length: 45 }, (_, i) => order(String(i), `o${i}`, "b1"));
    const { result } = renderHook(() => useOrderLabels(many));
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(getOffer).toHaveBeenCalledTimes(30);
  });
});
