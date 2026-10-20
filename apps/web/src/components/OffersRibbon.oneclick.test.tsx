import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OffersRibbon } from "./OffersRibbon";

const nearby = vi.fn();
const placeOrder = vi.fn();
let signedIn = true;

vi.mock("../api/offers", () => ({ offersApi: { nearby: (...a: unknown[]) => nearby(...a) } }));
vi.mock("../utils/placeOrder", () => ({ placeOrder: (...a: unknown[]) => placeOrder(...a) }));
vi.mock("../store/auth", () => ({
  useAuth: () => ({ user: signedIn ? { id: "u1", name: "Аня" } : null, isHydrated: true }),
}));

const live = (id: string, title: string, price = 36000) => ({
  id, businessId: "b-" + id, title, category: "FOOD", originalPrice: price * 2, discountedPrice: price, discountPercent: 50,
  baseDiscountPercent: 40, quantityTotal: 5, quantityLeft: 5, weightKg: 1, status: "ACTIVE", imageUrl: null,
  pickupStart: new Date(Date.now() - 3600_000).toISOString(), pickupEnd: new Date(Date.now() + 3 * 3600_000).toISOString(),
  businessName: "Кафе " + id, businessAddress: "Невский, 1", businessLat: 59.9, businessLng: 30.3, distanceKm: 0.5,
  // Состав, аллергены и срок годности указаны: без них «в 1 клик» недоступен (человек не увидел бы, что покупает).
  ingredients: "Свёкла, капуста, говяжий бульон, сметана", allergens: ["milk", "gluten"], allergensDeclared: true,
  bestBefore: new Date(Date.now() + 8 * 3600_000).toISOString(),
});

beforeEach(() => {
  nearby.mockReset();
  placeOrder.mockReset();
  localStorage.clear();
  signedIn = true;
  nearby.mockResolvedValue([live("o1", "Борщ с пампушками"), live("o2", "Пельмени")]);
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"), media: query, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }));
});

const renderRibbon = () => render(<MemoryRouter><OffersRibbon /></MemoryRouter>);
const orderButton = (title: string) => screen.findByRole("button", { name: new RegExp(`Заказать в 1 клик: ${title}`) });

describe("OffersRibbon one-click ordering", () => {
  it("first click asks for consent and orders only after it is confirmed", async () => {
    placeOrder.mockResolvedValue("ord-1");
    renderRibbon();
    await userEvent.click(await orderButton("Борщ с пампушками"));
    expect(screen.getByRole("dialog", { name: /Включить заказ в 1 клик/ })).toBeInTheDocument();
    expect(screen.getByText(/отменить нельзя/)).toBeInTheDocument();
    expect(placeOrder).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Заказать за 360/ }));
    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(1));
    expect(placeOrder).toHaveBeenCalledWith("o1", 1);
    const done = await screen.findByRole("link", { name: /Заказано/ });
    expect(done).toHaveAttribute("href", "/orders/ord-1");
    expect(localStorage.getItem("apetite.web.oneClickConsent")).toBe("1");
  });

  it("cancelling the consent dialog does not order and does not store consent", async () => {
    renderRibbon();
    await userEvent.click(await orderButton("Борщ с пампушками"));
    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(placeOrder).not.toHaveBeenCalled();
    expect(localStorage.getItem("apetite.web.oneClickConsent")).toBeNull();
  });

  it("with consent a single click orders immediately, and a double click makes ONE order", async () => {
    localStorage.setItem("apetite.web.oneClickConsent", "1");
    let release: (id: string) => void = () => {};
    placeOrder.mockReturnValue(new Promise<string>((resolve) => (release = resolve)));
    renderRibbon();
    const button = await orderButton("Пельмени");
    await userEvent.dblClick(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    release("ord-7");
    expect(await screen.findByRole("link", { name: /Заказано/ })).toHaveAttribute("href", "/orders/ord-7");
  });

  it("shows the failure inline and lets the user retry", async () => {
    localStorage.setItem("apetite.web.oneClickConsent", "1");
    placeOrder.mockRejectedValueOnce(new Error("Предложение закончилось"));
    renderRibbon();
    await userEvent.click(await orderButton("Борщ с пампушками"));
    expect(await screen.findByText("Предложение закончилось")).toBeInTheDocument();
    expect(await orderButton("Борщ с пампушками")).toBeEnabled();
  });

  it("guests get a login link instead of a buy button", async () => {
    signedIn = false;
    renderRibbon();
    const links = await screen.findAllByRole("link", { name: /Войти и заказать/ });
    expect(links[0]).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: /Заказать в 1 клик/ })).not.toBeInTheDocument();
  });

  it("falls back to demo tiles WITHOUT order buttons when the API is down", async () => {
    nearby.mockRejectedValue(new Error("down"));
    renderRibbon();
    await waitFor(() => expect(screen.getAllByText(/Burger Yard/).length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: /Заказать в 1 клик/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Войти и заказать/ })).not.toBeInTheDocument();
  });

  it("the tile names the allergens right above the order button", async () => {
    renderRibbon();
    await orderButton("Борщ с пампушками");
    expect(screen.getAllByText("Аллергены: молоко и лактоза, глютен (злаки)").length).toBeGreaterThan(0);
  });

  it("the consent dialog shows the ingredients, allergens and best-before date of the offer being ordered", async () => {
    renderRibbon();
    await userEvent.click(await orderButton("Борщ с пампушками"));
    const dialog = screen.getByRole("dialog", { name: /Включить заказ в 1 клик/ });
    expect(dialog).toHaveTextContent("Свёкла, капуста, говяжий бульон, сметана");
    expect(dialog).toHaveTextContent("Молоко и лактоза");
    expect(dialog).toHaveTextContent(/Годен до/);
  });

  it("an offer without declared ingredients cannot be ordered in 1 click: it leads to checkout, which says to ask the venue", async () => {
    nearby.mockResolvedValue([{ ...live("o3", "Старый борщ"), ingredients: null, allergens: [], allergensDeclared: false, bestBefore: null }]);
    renderRibbon();
    const link = (await screen.findAllByRole("link", { name: /Смотреть и заказать/ }))[0];
    expect(link).toHaveAttribute("href", "/checkout/o3");
    expect(screen.queryByRole("button", { name: /Заказать в 1 клик: Старый борщ/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Состав и аллергены не указаны").length).toBeGreaterThan(0);
  });

  it("flowers need no composition and stay one-click", async () => {
    nearby.mockResolvedValue([{ ...live("o4", "Букет дня"), category: "FLOWERS", ingredients: null, allergens: [], allergensDeclared: false, bestBefore: null }]);
    renderRibbon();
    expect(await orderButton("Букет дня")).toBeInTheDocument();
  });
});

