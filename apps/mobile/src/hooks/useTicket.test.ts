import { renderHook, waitFor } from "@testing-library/react-native";
import { useTicket } from "./useTicket";
import { ordersApi } from "../api/orders";
import { offersApi } from "../api/offers";
import { businessesApi } from "../api/businesses";
import { ApiError } from "../api/client";
import { loadTicket, saveTicket } from "../utils/ticketCache";

jest.mock("../api/orders", () => ({ ordersApi: { get: jest.fn(), getQrCode: jest.fn() } }));
jest.mock("../api/offers", () => ({ offersApi: { get: jest.fn() } }));
jest.mock("../api/businesses", () => ({ businessesApi: { get: jest.fn() } }));
jest.mock("../store/authStore", () => ({ useAuthStore: (select: (s: unknown) => unknown) => select({ user: { id: "u1" } }) }));
jest.mock("../utils/ticketCache", () => ({ loadTicket: jest.fn(), saveTicket: jest.fn() }));

const getOrder = ordersApi.get as jest.Mock;
const getQr = ordersApi.getQrCode as jest.Mock;
const getOffer = offersApi.get as jest.Mock;
const getBusiness = businessesApi.get as jest.Mock;
const load = loadTicket as jest.Mock;
const save = saveTicket as jest.Mock;

const ORDER = { id: "ord-1", offerId: "o1", businessId: "b1", status: "CONFIRMED", pickupCode: "482931", totalPrice: 24000, quantity: 1, createdAt: "2026-10-04T09:00:00Z" };
const OFFER = { id: "o1", title: "Набор десертов дня", pickupStart: "2026-10-04T10:00:00Z", pickupEnd: "2026-10-04T12:00:00Z", description: "лишнее поле" };
const BUSINESS = { id: "b1", name: "Кафе Пушкинъ", address: "Невский, 40", lat: 59.9, lng: 30.3, ownerUserId: "лишнее" };
const SAVED = { v: 1, userId: "u1", savedAt: "2026-10-04T09:05:00Z", order: ORDER, qrCodeDataUrl: "data:saved", offer: { id: "o1", title: "Набор (копия)", pickupStart: OFFER.pickupStart, pickupEnd: OFFER.pickupEnd }, venue: { id: "b1", name: "Кафе (копия)", address: "а", lat: 1, lng: 2 } };
const network = () => new ApiError(0, "Нет соединения с сервером");

beforeEach(() => {
  jest.clearAllMocks();
  load.mockResolvedValue(null);
  save.mockResolvedValue(undefined);
  getOrder.mockResolvedValue(ORDER);
  getQr.mockResolvedValue({ qrCodeDataUrl: "data:fresh" });
  getOffer.mockResolvedValue(OFFER);
  getBusiness.mockResolvedValue(BUSINESS);
});

describe("useTicket: online", () => {
  it("loads order, QR, offer and venue, and saves a copy for offline use", async () => {
    const { result } = renderHook(() => useTicket("ord-1"));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current).toMatchObject({ offline: false, qrCodeDataUrl: "data:fresh", venueState: { status: "ready" } });
    expect(result.current.offer?.title).toBe("Набор десертов дня");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const saved = save.mock.calls[0][0];
    expect(saved).toMatchObject({ v: 1, userId: "u1", qrCodeDataUrl: "data:fresh" });
    expect(saved.order.pickupCode).toBe("482931");
  });

  it("saves only what is needed: no description or owner id in the stored copy", async () => {
    renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const saved = save.mock.calls[0][0];
    expect(Object.keys(saved.offer).sort()).toEqual(["id", "pickupEnd", "pickupStart", "title"]);
    expect(Object.keys(saved.venue).sort()).toEqual(["address", "id", "lat", "lng", "name"]);
  });

  it("does not ask for a QR code for a finished order, and still shows the title and venue", async () => {
    getOrder.mockResolvedValue({ ...ORDER, status: "COMPLETED" });
    const { result } = renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getQr).not.toHaveBeenCalled();
    expect(result.current.offer?.title).toBe("Набор десертов дня");
    expect(result.current.qrCodeDataUrl).toBeNull();
  });

  it("an unreachable venue does not break the ticket: it opens with a retryable 'failed' venue", async () => {
    getBusiness.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.venueState).toEqual({ status: "failed" });
    expect(result.current.qrCodeDataUrl).toBe("data:fresh");
  });

  it("a ticket without a QR is not a ticket: shows the error with a retry, as before", async () => {
    getQr.mockRejectedValue(new ApiError(404, "QR не найден"));
    const { result } = renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("QR не найден");
  });

  it("reload fetches again", async () => {
    const { result } = renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    result.current.reload();
    await waitFor(() => expect(getOrder).toHaveBeenCalledTimes(2));
  });
});

describe("useTicket: with a saved copy", () => {
  it("opens the saved ticket instantly while the network is still working", async () => {
    load.mockResolvedValue(SAVED);
    getOrder.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.qrCodeDataUrl).toBe("data:saved");
    expect(result.current.order?.pickupCode).toBe("482931");
    expect(result.current.offline).toBe(false);
  });

  it("falls back to the saved copy and says it is offline when there is no connection", async () => {
    load.mockResolvedValue(SAVED);
    getOrder.mockRejectedValue(network());
    const { result } = renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(result.current.offline).toBe(true));
    expect(result.current).toMatchObject({ status: "ready", qrCodeDataUrl: "data:saved", savedAt: SAVED.savedAt });
    expect(result.current.venueState).toMatchObject({ status: "ready", business: { name: "Кафе (копия)" } });
    expect(save).not.toHaveBeenCalled();
  });

  it("does the same when the server itself is down (5xx)", async () => {
    load.mockResolvedValue(SAVED);
    getOrder.mockRejectedValue(new ApiError(503, "Service Unavailable"));
    const { result } = renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(result.current.offline).toBe(true));
  });

  it("fresh data replaces the saved copy once the network answers", async () => {
    load.mockResolvedValue(SAVED);
    const { result } = renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(result.current.qrCodeDataUrl).toBe("data:fresh"));
    expect(result.current.offer?.title).toBe("Набор десертов дня");
    expect(result.current.offline).toBe(false);
  });

  it("keeps the saved QR when only the QR request fails but the order itself loaded", async () => {
    load.mockResolvedValue(SAVED);
    getQr.mockRejectedValue(network());
    const { result } = renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await waitFor(() => expect(result.current.offer?.title).toBe("Набор десертов дня"));
    expect(result.current.qrCodeDataUrl).toBe("data:saved");
    expect(result.current.offline).toBe(false);
  });

  it("does NOT hide a real answer behind the copy: 404 (no such order) is an error even if a copy exists", async () => {
    load.mockResolvedValue(SAVED);
    getOrder.mockRejectedValue(new ApiError(404, "Заказ не найден"));
    const { result } = renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Заказ не найден");
    expect(result.current.qrCodeDataUrl).toBeNull();
  });

  it("looks the copy up for the right user and order", async () => {
    renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(load).toHaveBeenCalledWith("ord-1", "u1"));
  });
});

describe("useTicket: no connection and no copy", () => {
  it("shows the plain error with a retry, nothing invented", async () => {
    getOrder.mockRejectedValue(network());
    const { result } = renderHook(() => useTicket("ord-1"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Нет соединения с сервером");
    expect(result.current.order).toBeNull();
  });
});
