import React from "react";
import { Linking } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import "../../i18n";
import { OfferDetailScreen } from "./OfferDetailScreen";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { offersApi } from "../../api/offers";
import { businessesApi } from "../../api/businesses";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../../api/offers", () => ({ offersApi: { get: jest.fn() } }));
jest.mock("../../api/businesses", () => ({ businessesApi: { get: jest.fn() } }));

const getOffer = offersApi.get as jest.Mock;
const getBusiness = businessesApi.get as jest.Mock;
const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

const OFFER = {
  id: "o1", businessId: "b1", title: "Шаурма классическая", description: "Сочная говядина и свежие овощи", category: "FOOD",
  originalPrice: 32000, discountedPrice: 12800, discountPercent: 60, baseDiscountPercent: 40, imageUrl: null, quantityTotal: 10, quantityLeft: 8,
  weightKg: 0.4, pickupStart: hours(-1), pickupEnd: hours(2.5), status: "ACTIVE", featured: false, createdAt: hours(-3), updatedAt: hours(-1),
};
const BUSINESS = { id: "b1", name: "Shava Point", address: "Невский проспект, 40", lat: 59.93, lng: 30.36 };

function setup(offer: Record<string, unknown> = {}) {
  getOffer.mockResolvedValue({ ...OFFER, ...offer });
  const navigate = jest.fn();
  const props = { navigation: { navigate }, route: { key: "OfferDetail", name: "OfferDetail", params: { offerId: "o1" } } } as unknown;
  const view = render(
    <ThemeProvider>
      <OfferDetailScreen {...(props as React.ComponentProps<typeof OfferDetailScreen>)} />
    </ThemeProvider>
  );
  return { view, navigate };
}

beforeEach(() => {
  jest.clearAllMocks();
  getBusiness.mockResolvedValue(BUSINESS);
});

describe("OfferDetailScreen", () => {
  it("shows the whole offer: title, description, venue, prices and what you save", async () => {
    const { view } = setup();
    await waitFor(() => expect(view.getByText("Шаурма классическая")).toBeTruthy());
    expect(view.getByText("Сочная говядина и свежие овощи")).toBeTruthy();
    await waitFor(() => expect(view.getAllByText("Shava Point").length).toBeGreaterThan(0));
    expect(view.getAllByText(/128\s?₽/).length).toBeGreaterThan(0);
    expect(view.getByText(/320\s?₽/)).toBeTruthy();
    expect(view.getByText(/Экономия 192/)).toBeTruthy();
    expect(view.getByText("Еда")).toBeTruthy();
  });

  it("explains pickup: time left, readable window, stock and the address", async () => {
    const { view } = setup();
    await waitFor(() => expect(view.getByText(/ещё 2 ч 29 мин|ещё 2 ч 30 мин/)).toBeTruthy());
    // Окно «−1 ч … +2,5 ч» после ~21:30 переходит через полночь — тогда подпись «17:35 — завтра 18:35»; тест не должен зависеть от часа запуска.
    expect(view.getByText(/Забрать: \d{2}:\d{2}(–\d{2}:\d{2}| — завтра \d{2}:\d{2})/)).toBeTruthy();
    expect(view.getByText("8 из 10")).toBeTruthy();
    await waitFor(() => expect(view.getByText("Невский проспект, 40")).toBeTruthy());
  });

  it("marks the deal of the day as hot even with a 24h window", async () => {
    const { view } = setup({ featured: true, pickupEnd: hours(23.5) });
    await waitFor(() => expect(view.getByText("Предложение дня")).toBeTruthy());
  });

  it("warns when the stock is almost gone", async () => {
    const { view } = setup({ quantityLeft: 2 });
    await waitFor(() => expect(view.getByText("Почти раскупили")).toBeTruthy());
    expect(view.getByText("2 из 10")).toBeTruthy();
  });

  it("opens the checkout for this offer from the pinned bar", async () => {
    const { view, navigate } = setup();
    await waitFor(() => expect(view.getByRole("button", { name: "Купить" })).toBeTruthy());
    fireEvent.press(view.getByRole("button", { name: "Купить" }));
    expect(navigate).toHaveBeenCalledWith("Checkout", { offerId: "o1" });
  });

  it("blocks the purchase when sold out", async () => {
    const { view, navigate } = setup({ quantityLeft: 0 });
    await waitFor(() => expect(view.getAllByText("Раскупили").length).toBeGreaterThan(0));
    fireEvent.press(view.getByRole("button", { name: "Раскупили" }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("blocks the purchase when the pickup window is over, and says so", async () => {
    const { view, navigate } = setup({ pickupEnd: hours(-1) });
    await waitFor(() => expect(view.getByText("Окно самовывоза закрыто")).toBeTruthy());
    fireEvent.press(view.getByRole("button", { name: "Время вышло" }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("tells the user up front that an order can't be cancelled after payment", async () => {
    const { view } = setup();
    await waitFor(() => expect(view.getByText("После оплаты заказ отменить нельзя")).toBeTruthy());
  });

  it("says when the pickup window has not opened yet", async () => {
    const { view } = setup({ pickupStart: hours(2), pickupEnd: hours(5) });
    await waitFor(() => expect(view.getByText(/Откроется в \d{2}:\d{2}/)).toBeTruthy());
  });

  it("opens directions to the venue", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { view } = setup();
    await waitFor(() => expect(view.getByRole("button", { name: "Маршрут" })).toBeTruthy());
    fireEvent.press(view.getByRole("button", { name: "Маршрут" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0][0])).toContain("59.93");
  });

  it("still lets the user buy when the venue request fails (address is not critical)", async () => {
    getBusiness.mockRejectedValue(new Error("down"));
    const { view, navigate } = setup();
    await waitFor(() => expect(view.getByText(/Адрес недоступен/)).toBeTruthy());
    fireEvent.press(view.getByRole("button", { name: "Купить" }));
    expect(navigate).toHaveBeenCalledWith("Checkout", { offerId: "o1" });
  });

  it("shows the error with a retry when the offer cannot be loaded", async () => {
    getOffer.mockRejectedValueOnce(new Error("Оффер не найден"));
    const navigate = jest.fn();
    const props = { navigation: { navigate }, route: { key: "OfferDetail", name: "OfferDetail", params: { offerId: "o1" } } } as unknown;
    const view = render(<ThemeProvider><OfferDetailScreen {...(props as React.ComponentProps<typeof OfferDetailScreen>)} /></ThemeProvider>);
    await waitFor(() => expect(view.getByText("Оффер не найден")).toBeTruthy());
    getOffer.mockResolvedValue(OFFER);
    fireEvent.press(view.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(view.getByText("Шаурма классическая")).toBeTruthy());
  });
});
