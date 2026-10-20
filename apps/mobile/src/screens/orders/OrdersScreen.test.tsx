import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import "../../i18n";
import { OrdersScreen } from "./OrdersScreen";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { ordersApi } from "../../api/orders";
import { offersApi } from "../../api/offers";
import { businessesApi } from "../../api/businesses";
import { ApiError } from "../../api/client";
import { clearOrderLabelCache } from "../../hooks/useOrderLabels";
import { loadOrders, saveOrders } from "../../utils/ordersCache";

jest.mock("@react-navigation/native", () => ({ useFocusEffect: (callback: () => void) => require("react").useEffect(callback, [callback]) }));
jest.mock("../../api/orders", () => ({ ordersApi: { list: jest.fn() } }));
jest.mock("../../api/offers", () => ({ offersApi: { get: jest.fn() } }));
jest.mock("../../api/businesses", () => ({ businessesApi: { get: jest.fn() } }));
jest.mock("../../store/authStore", () => ({ useAuthStore: (select: (s: unknown) => unknown) => select({ user: { id: "u1" } }) }));
jest.mock("../../utils/ordersCache", () => ({ loadOrders: jest.fn(), saveOrders: jest.fn() }));

const list = ordersApi.list as jest.Mock;
const load = loadOrders as jest.Mock;
const save = saveOrders as jest.Mock;
const ORDER = { id: "ord-1", userId: "u1", offerId: "o1", businessId: "b1", quantity: 1, totalPrice: 24000, status: "CONFIRMED", pickupCode: "482931", createdAt: new Date(2026, 9, 4, 12, 22).toISOString() };
const SAVED = { v: 1, userId: "u1", savedAt: new Date(2026, 9, 4, 12, 30).toISOString(), orders: [ORDER], titles: { o1: "Набор десертов дня" }, venues: { b1: "Кафе Пушкинъ" } };

function mount() {
  const navigate = jest.fn();
  const view = render(
    <ThemeProvider>
      <OrdersScreen {...({ navigation: { navigate } } as unknown as React.ComponentProps<typeof OrdersScreen>)} />
    </ThemeProvider>
  );
  return { view, navigate };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearOrderLabelCache();
  load.mockResolvedValue(null);
  save.mockResolvedValue(undefined);
  (offersApi.get as jest.Mock).mockResolvedValue({ id: "o1", title: "Набор десертов дня" });
  (businessesApi.get as jest.Mock).mockResolvedValue({ id: "b1", name: "Кафе Пушкинъ" });
});

describe("OrdersScreen: online", () => {
  it("shows the list with titles and venues and saves a copy once the labels are known", async () => {
    list.mockResolvedValue([ORDER]);
    const { view } = mount();
    await waitFor(() => expect(view.getByText("Набор десертов дня")).toBeTruthy());
    expect(view.getByText("Кафе Пушкинъ")).toBeTruthy();
    expect(view.queryByText("Нет сети")).toBeNull();
    await waitFor(() => expect(save.mock.calls.some(([snap]) => snap.titles?.o1 === "Набор десертов дня")).toBe(true));
    expect(save.mock.calls.at(-1)?.[0]).toMatchObject({ userId: "u1", orders: [ORDER], venues: { b1: "Кафе Пушкинъ" } });
  });
});

describe("OrdersScreen: no connection", () => {
  it("opens the saved list with its titles and a 'no connection' notice instead of an error", async () => {
    list.mockRejectedValue(new ApiError(0, "Нет соединения"));
    load.mockResolvedValue(SAVED);
    (offersApi.get as jest.Mock).mockRejectedValue(new ApiError(0, "Нет соединения"));
    (businessesApi.get as jest.Mock).mockRejectedValue(new ApiError(0, "Нет соединения"));
    const { view } = mount();
    await waitFor(() => expect(view.getByText("Нет сети")).toBeTruthy());
    expect(view.getByText("Набор десертов дня")).toBeTruthy();
    expect(view.getByText("Кафе Пушкинъ")).toBeTruthy();
    expect(view.getByText("Показан сохранённый список. Статусы могли устареть.")).toBeTruthy();
    expect(view.getByText("Сохранено в 12:30")).toBeTruthy();
  });

  it("does not overwrite the saved copy with itself (that would reset its timestamp)", async () => {
    list.mockRejectedValue(new ApiError(0, "Нет соединения"));
    load.mockResolvedValue(SAVED);
    const { view } = mount();
    await waitFor(() => expect(view.getByText("Нет сети")).toBeTruthy());
    expect(save).not.toHaveBeenCalled();
  });

  it("still opens the order from the saved list", async () => {
    list.mockRejectedValue(new ApiError(0, "Нет соединения"));
    load.mockResolvedValue(SAVED);
    const { view, navigate } = mount();
    await waitFor(() => expect(view.getByText("Набор десертов дня")).toBeTruthy());
    fireEvent.press(view.getByRole("button", { name: /Набор десертов дня/ }));
    expect(navigate).toHaveBeenCalledWith("OrderDetail", { orderId: "ord-1" });
  });

  it("uses the saved list when the server is down too (5xx)", async () => {
    list.mockRejectedValue(new ApiError(502, "Bad Gateway"));
    load.mockResolvedValue(SAVED);
    const { view } = mount();
    await waitFor(() => expect(view.getByText("Нет сети")).toBeTruthy());
  });

  it("with nothing saved, shows the plain error with a retry", async () => {
    list.mockRejectedValue(new ApiError(0, "Нет соединения с сервером"));
    const { view } = mount();
    await waitFor(() => expect(view.getByText("Нет соединения")).toBeTruthy());
    expect(view.getByText(/интернета нет/)).toBeTruthy();
    expect(view.getByRole("button", { name: "Повторить" })).toBeTruthy();
    expect(view.queryByText("Нет сети")).toBeNull();
  });

  it("does not hide a real server answer (403) behind a saved copy", async () => {
    list.mockRejectedValue(new ApiError(403, "Нет доступа"));
    load.mockResolvedValue(SAVED);
    const { view } = mount();
    await waitFor(() => expect(view.getByText("Нет доступа")).toBeTruthy());
    expect(view.queryByText("Набор десертов дня")).toBeNull();
  });
});

describe("OrdersScreen: states", () => {
  it("while loading shows row-shaped placeholders under the title, not a bare spinner", () => {
    list.mockReturnValue(new Promise(() => {}));
    const { view } = mount();
    expect(view.getByText("Мои заказы")).toBeTruthy();
    expect(view.getByRole("progressbar", { name: "Загрузка..." })).toBeTruthy();
  });

  it("with no orders offers a way forward: a friendly empty state that leads to the offers", async () => {
    list.mockResolvedValue([]);
    const { view, navigate } = mount();
    await waitFor(() => expect(view.getByText("Заказов пока нет")).toBeTruthy());
    expect(view.getByText(/Найдите предложение рядом/)).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Смотреть предложения" }));
    expect(navigate).toHaveBeenCalledWith("Home");
  });

  it("shows the status as a badge next to the date", async () => {
    list.mockResolvedValue([ORDER]);
    const { view } = mount();
    await waitFor(() => expect(view.getByText("Ожидает самовывоза")).toBeTruthy());
    expect(view.getByText(/4 окт/)).toBeTruthy();
  });
});

