import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import "../../i18n";
import { OrderDetailScreen } from "./OrderDetailScreen";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { useTicket } from "../../hooks/useTicket";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../../hooks/useTicket", () => ({ useTicket: jest.fn() }));

const mockTicket = useTicket as jest.Mock;
const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

const ORDER = { id: "ord-1", offerId: "o1", businessId: "b1", quantity: 1, totalPrice: 24000, status: "CONFIRMED", pickupCode: "482931", createdAt: hours(-3), acceptedAt: hours(-2) };
const VENUE = { id: "b1", name: "Кафе Пушкинъ", address: "Невский, 40", lat: 59.9, lng: 30.3 };

function ticket(over: Record<string, unknown> = {}, offerWindow: [number, number] = [-1, 1]) {
  return {
    status: "ready",
    order: ORDER,
    offer: { id: "o1", title: "Набор десертов дня", pickupStart: hours(offerWindow[0]), pickupEnd: hours(offerWindow[1]) },
    qrCodeDataUrl: "data:image/png;base64,AAA",
    venue: VENUE,
    venueState: { status: "ready", business: VENUE },
    offline: false,
    savedAt: null,
    error: null,
    reload: jest.fn(),
    ...over,
  };
}

function mount() {
  return render(
    <ThemeProvider>
      <OrderDetailScreen {...({ route: { key: "OrderDetail", name: "OrderDetail", params: { orderId: "ord-1" } } } as unknown as React.ComponentProps<typeof OrderDetailScreen>)} />
    </ThemeProvider>
  );
}

const hasCode = (view: ReturnType<typeof mount>) => view.queryByLabelText(/Код самовывоза: 4 8 2 9 3 1/) !== null;

beforeEach(() => jest.clearAllMocks());

describe("OrderDetailScreen", () => {
  it("shows the pickup code of an active order, with the title and amount", () => {
    mockTicket.mockReturnValue(ticket());
    const view = mount();
    expect(view.getByText("Набор десертов дня")).toBeTruthy();
    expect(view.getByText(/240 ₽ · x1/)).toBeTruthy();
    expect(hasCode(view)).toBe(true);
    expect(view.queryByText("Нет сети")).toBeNull();
  });

  it("offline: still shows the code with the 'show it at the counter' notice while the window is open", () => {
    mockTicket.mockReturnValue(ticket({ offline: true, savedAt: hours(-0.1) }));
    const view = mount();
    expect(hasCode(view)).toBe(true);
    expect(view.getByText(/код можно показать кассиру/)).toBeTruthy();
  });

  it("offline with the pickup window over: the saved code is NOT offered, the order reads as expired", () => {
    mockTicket.mockReturnValue(ticket({ offline: true, savedAt: hours(-3) }, [-3, -1]));
    const view = mount();
    expect(hasCode(view)).toBe(false);
    expect(view.getByText("Время самовывоза истекло")).toBeTruthy();
    expect(view.getByText("Просрочен")).toBeTruthy();
    expect(view.queryByText(/можно показать кассиру/)).toBeNull();
    expect(view.getByText(/Время самовывоза истекло, статус мог измениться/)).toBeTruthy();
    expect(view.queryByRole("button", { name: /Построить маршрут/ })).toBeNull();
  });

  it("online with a window that is over keeps whatever the server says (the server sets EXPIRED itself)", () => {
    mockTicket.mockReturnValue(ticket({}, [-3, -1]));
    const view = mount();
    expect(hasCode(view)).toBe(true);
  });

  it("a finished order shows the note, the venue (no route) and help", () => {
    mockTicket.mockReturnValue(ticket({ order: { ...ORDER, status: "COMPLETED" }, qrCodeDataUrl: null }));
    const view = mount();
    expect(view.getByText("Заказ выдан, спасибо!")).toBeTruthy();
    expect(view.getByText("Кафе Пушкинъ")).toBeTruthy();
    expect(view.queryByRole("button", { name: /Построить маршрут/ })).toBeNull();
    expect(view.getByRole("button", { name: /Нужна помощь с заказом/ })).toBeTruthy();
    expect(hasCode(view)).toBe(false);
  });

  it("a lost connection (no saved copy) shows the offline state with a retry, not a raw error", () => {
    const reload = jest.fn();
    mockTicket.mockReturnValue({ ...ticket(), status: "error", order: null, error: "Нет соединения с сервером", networkError: true, reload });
    const view = mount();
    expect(view.getByText("Нет соединения")).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Повторить" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("a handed-over order asks the buyer to confirm receipt", () => {
    mockTicket.mockReturnValue(ticket({ order: { ...ORDER, status: "COMPLETED", receiptConfirmedAt: null, receiptDisputedAt: null }, qrCodeDataUrl: null }));
    const view = mount();
    expect(view.getByText("Вы получили заказ?")).toBeTruthy();
  });

  it("an active order does not ask about receipt yet", () => {
    mockTicket.mockReturnValue(ticket());
    expect(mount().queryByText("Вы получили заказ?")).toBeNull();
  });

  it("shows loading and error states", () => {
    mockTicket.mockReturnValue({ ...ticket(), status: "loading", order: null });
    expect(mount().getByText("Загрузка...")).toBeTruthy();
    const reload = jest.fn();
    mockTicket.mockReturnValue({ ...ticket(), status: "error", order: null, error: "Заказ не найден", reload });
    const view = mount();
    expect(view.getByText("Заказ не найден")).toBeTruthy();
    expect(view.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });
});
