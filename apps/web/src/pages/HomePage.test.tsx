import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { NearbyOffer } from "@apetite/shared";
import { HomePage } from "./HomePage";

const NOW = Date.now();
const offer = (n: number, over: Partial<NearbyOffer> = {}): NearbyOffer =>
  ({
    id: `o${n}`, title: `Блюдо ${n}`, businessName: `Кафе ${n}`, businessAddress: "Невский, 1", businessLat: 59.93, businessLng: 30.36, category: "FOOD",
    discountPercent: 50, originalPrice: 40000, discountedPrice: 20000, pickupStart: new Date(NOW - 3600_000).toISOString(),
    pickupEnd: new Date(NOW + 5 * 3600_000).toISOString(), distanceKm: 0.4, quantityLeft: 3, featured: false, imageUrl: null, ...over,
  }) as unknown as NearbyOffer;

const nearby = vi.hoisted(() => ({ calls: [] as unknown[], centers: [] as unknown[], offers: [] as NearbyOffer[] }));
const CITY = { lat: 59.9311, lng: 30.3609, isFallback: true };
const geo = vi.hoisted(() => ({
  value: { location: { lat: 59.9311, lng: 30.3609, isFallback: true }, status: "idle", locate: vi.fn(), reset: vi.fn() } as {
    location: { lat: number; lng: number; isFallback: boolean };
    status: string;
    locate: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  },
}));

vi.mock("../hooks/useNearbyOffers", () => ({
  DEFAULT_RADIUS_KM: 20,
  useNearbyOffers: (center: unknown, filters: unknown) => {
    nearby.calls.push(filters);
    nearby.centers.push(center);
    return { offers: nearby.offers, dataKey: `k|${JSON.stringify(center)}|${JSON.stringify(filters)}`, error: null, loading: false, reload: vi.fn() };
  },
}));
vi.mock("../hooks/useGeolocation", () => ({ useGeolocation: () => geo.value }));
vi.mock("../hooks/useYandexMaps", () => ({ getYandexApiKey: () => undefined, useYandexMaps: () => ({ status: "off", api: null }) }));
// Настоящий Leaflet в jsdom не нужен: здесь проверяем связку ленты, фильтров и карты, а не тайлы.
vi.mock("../components/OffersMap", () => ({
  OffersMap: (props: { offers: NearbyOffer[]; focus?: NearbyOffer[]; userPosition: unknown; fitKey: string; selectedId: string | null; onSelect: (id: string | null) => void }) => (
    <div
      data-testid="map"
      data-count={props.offers.length}
      data-selected={props.selectedId ?? ""}
      data-focus={props.focus ? props.focus.map((o) => o.id).join(",") : "none"}
      data-user={props.userPosition ? "yes" : "no"}
      data-fitkey={props.fitKey}
    >
      {props.offers.map((o) => (
        <button key={o.id} type="button" onClick={() => props.onSelect(o.id)}>
          pin {o.title}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("../store/auth", () => ({ useAuth: () => ({ user: null }) }));

const scrollIntoView = vi.fn();

beforeEach(() => {
  geo.value = { location: { ...CITY }, status: "idle", locate: vi.fn(), reset: vi.fn() };
  localStorage.clear();
  nearby.calls = [];
  nearby.centers = [];
  nearby.offers = [offer(1), offer(2, { pickupEnd: new Date(NOW + 20 * 60_000).toISOString() }), offer(3)];
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
});

const renderPage = () => render(<MemoryRouter><HomePage /></MemoryRouter>);

describe("HomePage: feed on top, map below", () => {
  it("renders the 'Сейчас на витрине' feed before the map section, in that order", () => {
    renderPage();
    const feed = screen.getByRole("heading", { level: 1 });
    const map = screen.getByRole("heading", { level: 2, name: "На карте" });
    expect(feed.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.getElementById("map")).toContainElement(screen.getByTestId("map"));
  });

  it("puts the burning offer first in the feed and feeds the very same set to the map", () => {
    renderPage();
    const cards = screen.getAllByRole("button", { name: /Показать на карте/ });
    expect(cards[0]).toHaveAccessibleName(/Блюдо 2/);
    expect(screen.getByTestId("map")).toHaveAttribute("data-count", "3");
  });

  it("tapping a feed card opens it on the map and scrolls to the map", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Блюдо 3, Кафе 3/ }));
    expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "o3");
    expect(screen.getByRole("complementary", { name: /Предложение: Блюдо 3/ })).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("choosing an offer on the map highlights its card in the feed without scrolling the page", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "pin Блюдо 1" }));
    expect(screen.getByRole("button", { name: /Блюдо 1, Кафе 1/ })).toHaveAttribute("aria-pressed", "true");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("closing the offer card clears the selection", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Блюдо 1, Кафе 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Закрыть карточку" }));
    expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "");
    expect(screen.queryByRole("complementary", { name: /Предложение:/ })).toBeNull();
  });

  it("the 'Горящие' filter narrows BOTH the feed and the map", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Горящие/ }));
    expect(screen.getAllByRole("button", { name: /Показать на карте/ })).toHaveLength(1);
    expect(screen.getByTestId("map")).toHaveAttribute("data-count", "1");
  });

  it("a category tab filters on the client (no refetch) and drops the selection", () => {
    nearby.offers = [offer(1), offer(2, { category: "FLOWERS" as never })];
    renderPage();
    const callsBefore = nearby.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Блюдо 1, Кафе 1/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Цветы" }));
    expect((nearby.calls.at(-1) as { category?: string }).category).toBeUndefined(); // категории в запросе нет
    expect(screen.getAllByRole("button", { name: /Показать на карте/ })).toHaveLength(1);
    expect(screen.getByTestId("map")).toHaveAttribute("data-count", "1");
    expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "");
    expect(nearby.calls.at(-1)).toEqual({ radiusKm: 20 });
    expect(nearby.calls.length - callsBefore).toBeLessThan(5); // повторные рендеры, а не новые данные: dataKey не менялся
  });

  it("the end card of the feed scrolls to the map", () => {
    renderPage();
    fireEvent.click(within(screen.getByRole("list", { name: "Предложения" })).getByRole("button", { name: /Все на карте/ }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("the layer switch lives in the map header and is remembered", () => {
    localStorage.clear();
    renderPage();
    const group = screen.getByRole("group", { name: "Вид карты" });
    fireEvent.click(within(group).getByRole("button", { name: "Спутник" }));
    expect(within(group).getByRole("button", { name: "Спутник" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("apetite.web.mapStyle")).toBe("satellite");
    localStorage.clear();
  });
});


/** Витрина «рядом со мной»: позиция определена — ближайшие первыми, карта охватывает район, а не город. */
describe("HomePage: geolocation", () => {
  const near = (n: number, km: number, over: Partial<NearbyOffer> = {}) => offer(n, { distanceKm: km, ...over });
  const located = (lat = 59.95, lng = 30.31) => {
    geo.value = { ...geo.value, location: { lat, lng, isFallback: false }, status: "granted" };
  };

  it("first visit: a polite prompt BEFORE any system dialog; 'Определить' asks, 'Не сейчас' is remembered", () => {
    renderPage();
    expect(screen.getByText(/Показать ближайшие предложения первыми/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Рядом со мной/ })).toBeNull(); // не дублируем кнопку, пока висит приглашение
    fireEvent.click(screen.getByRole("button", { name: "Определить местоположение" }));
    expect(geo.value.locate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Не сейчас" }));
    expect(screen.queryByText(/Показать ближайшие предложения первыми/)).toBeNull();
    expect(localStorage.getItem("apetite.web.geoPrompt")).toBe("dismissed");
    // «Рядом со мной» в строке под заголовком остаётся — отказ от приглашения не прячет саму возможность
    expect(screen.getByRole("button", { name: /Рядом со мной/ })).toBeInTheDocument();
  });

  it("does not nag again after it was dismissed, and not when the permission is already decided", () => {
    localStorage.setItem("apetite.web.geoPrompt", "dismissed");
    renderPage();
    expect(screen.queryByText(/Показать ближайшие предложения первыми/)).toBeNull();
  });

  it("without a position the feed is hot-first and the query is centred on the city", () => {
    nearby.offers = [near(1, 0.3), near(2, 5, { pickupEnd: new Date(NOW + 20 * 60_000).toISOString() })];
    renderPage();
    expect(screen.getAllByRole("button", { name: /Показать на карте/ })[0]).toHaveAccessibleName(/Блюдо 2/);
    expect(nearby.centers.at(-1)).toMatchObject({ lat: CITY.lat, lng: CITY.lng });
    expect(screen.getByTestId("map")).toHaveAttribute("data-focus", "none");
    expect(screen.getByTestId("map")).toHaveAttribute("data-user", "no");
  });

  it("with a position: the query is centred on the person, nearest first, the map focuses on the nearest and shows the person", () => {
    located();
    nearby.offers = [near(1, 6), near(2, 0.2, { pickupEnd: new Date(NOW + 6 * 3600_000).toISOString() }), near(3, 0.4, { pickupEnd: new Date(NOW + 20 * 60_000).toISOString() })];
    renderPage();
    expect(nearby.centers.at(-1)).toMatchObject({ lat: 59.95, lng: 30.31 });
    const order = screen.getAllByRole("button", { name: /Показать на карте/ }).map((b) => b.getAttribute("aria-label")!.split(",")[0]);
    expect(order).toEqual(["Блюдо 2", "Блюдо 3", "Блюдо 1"]); // 200 м, 400 м, 6 км — несмотря на «горит» у третьего
    expect(screen.getByRole("status")).toHaveTextContent("Рядом с вами · ближайшие первыми");
    expect(screen.getByTestId("map")).toHaveAttribute("data-focus", "o2,o3,o1");
    expect(screen.getByTestId("map")).toHaveAttribute("data-user", "yes");
  });

  it("the focus is only the nearest handful — a district, not the whole city", () => {
    located();
    nearby.offers = Array.from({ length: 20 }, (_, i) => near(i + 1, i + 1));
    renderPage();
    expect(screen.getByTestId("map").getAttribute("data-focus")!.split(",")).toHaveLength(8);
  });

  it("'Горящие' puts the burning first again, and the choice is the user's to make", () => {
    located();
    nearby.offers = [near(1, 0.2, { pickupEnd: new Date(NOW + 6 * 3600_000).toISOString() }), near(2, 3, { pickupEnd: new Date(NOW + 20 * 60_000).toISOString() })];
    renderPage();
    expect(screen.getAllByRole("button", { name: /Показать на карте/ })[0]).toHaveAccessibleName(/Блюдо 1/);
    fireEvent.click(screen.getByRole("button", { name: "Сначала горящие" }));
    expect(screen.getAllByRole("button", { name: /Показать на карте/ })[0]).toHaveAccessibleName(/Блюдо 2/);
    expect(screen.getByRole("status")).toHaveTextContent("горящие первыми");
  });

  it("from a suburb the search radius is widened so the whole city is still reachable", () => {
    located(59.55, 30.12); // Гатчина, ~42 км от центра
    renderPage();
    const filters = nearby.calls.at(-1) as { radiusKm: number };
    expect(filters.radiusKm).toBeGreaterThanOrEqual(60);
    expect(filters.radiusKm).toBeLessThanOrEqual(100);
  });

  it("in the city centre the usual 20 km radius is kept", () => {
    located(59.94, 30.33);
    renderPage();
    expect((nearby.calls.at(-1) as { radiusKm: number }).radiusKm).toBeLessThanOrEqual(22);
  });

  it("a person outside Saint Petersburg gets the whole city instead of an empty showcase", () => {
    located(55.7558, 37.6173); // Москва
    nearby.offers = [near(1, 300)];
    renderPage();
    expect(nearby.centers.at(-1)).toMatchObject({ lat: CITY.lat, lng: CITY.lng });
    expect(screen.getByRole("status")).toHaveTextContent("за пределами Санкт-Петербурга");
    expect(screen.getByTestId("map")).toHaveAttribute("data-user", "no");
    expect(screen.getByTestId("map")).toHaveAttribute("data-focus", "none");
  });

  it("'Весь город' lets go of the position", () => {
    located();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Весь город/ }));
    expect(geo.value.reset).toHaveBeenCalledTimes(1);
  });

  it("the round button on the map asks when the position is unknown", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Определить моё местоположение" }));
    expect(geo.value.locate).toHaveBeenCalledTimes(1);
  });

  it("the round button on the map brings the view back to the person (a new fit) and refreshes the position", () => {
    located();
    renderPage();
    const before = screen.getByTestId("map").getAttribute("data-fitkey");
    fireEvent.click(screen.getByRole("button", { name: "Вернуться к моему местоположению" }));
    expect(screen.getByTestId("map").getAttribute("data-fitkey")).not.toBe(before);
    expect(geo.value.locate).toHaveBeenCalledTimes(1);
  });
});


/** Фильтры из панели: категория и цена «от — до» действуют и на ленту, и на карту. */
describe("HomePage: filters panel", () => {
  const priced = (n: number, rub: number, over: Partial<NearbyOffer> = {}) => offer(n, { discountedPrice: rub * 100, originalPrice: rub * 200, ...over });

  const openPanel = () => fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  const type = (label: string, value: string) => fireEvent.change(within(screen.getByRole("dialog", { name: "Фильтры" })).getByLabelText(label), { target: { value } });

  it("the round filters button replaces the old pause button and opens the panel (price + category)", () => {
    nearby.offers = [priced(1, 150), priced(2, 450)];
    renderPage();
    expect(screen.queryByRole("button", { name: /Остановить движение ленты/ })).toBeNull();
    openPanel();
    const dialog = screen.getByRole("dialog", { name: "Фильтры" });
    expect(within(dialog).getByLabelText("От")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("До")).toBeInTheDocument();
    expect(within(dialog).getByText(/Сейчас на витрине: от 150 ₽ до 450 ₽/)).toBeInTheDocument();
  });

  it("applying a price range narrows BOTH the feed and the map, and the button shows the live count first", () => {
    nearby.offers = [priced(1, 150), priced(2, 450), priced(3, 900)];
    renderPage();
    openPanel();
    type("От", "200");
    type("До", "500");
    fireEvent.click(screen.getByRole("button", { name: "Показать 1" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Показать на карте/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Показать на карте/ })[0]).toHaveAccessibleName(/Блюдо 2/);
    expect(screen.getByTestId("map")).toHaveAttribute("data-count", "1");
    expect(screen.getByRole("button", { name: /Сбросить фильтр по цене: 200–500 ₽/ })).toBeInTheDocument();
  });

  it("invalid input is explained and cannot be applied; fixing it re-enables the button", () => {
    nearby.offers = [priced(1, 150), priced(2, 450), priced(3, 900)];
    renderPage();
    openPanel();
    type("От", "9x");
    expect(screen.getByText("Введите число без букв и знаков")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Исправьте цену" })).toBeDisabled();
    type("От", "500");
    type("До", "300");
    expect(screen.getAllByText("«От» не может быть больше «до»").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("От")).toHaveAttribute("aria-invalid", "true");
    type("От", "200");
    type("До", "600");
    expect(screen.queryByText("«От» не может быть больше «до»")).toBeNull();
    expect(screen.getByRole("button", { name: "Показать 1" })).toBeEnabled();
  });

  it("a price below the cheapest or above the dearest offer cannot be chosen — the reason is shown, one tap fixes it", () => {
    nearby.offers = [priced(1, 150), priced(2, 900)];
    renderPage();
    openPanel();
    type("От", "50");
    expect(screen.getByText(/Минимальная цена на витрине — 150 ₽/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Исправьте цену" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Поставить 150 ₽" }));
    type("До", "5000");
    expect(screen.getByText(/Максимальная цена на витрине — 900 ₽/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Поставить 900 ₽" }));
    expect(screen.getByRole("button", { name: "Показать 2" })).toBeEnabled();
  });

  it("a category without offers is not selectable in the panel", () => {
    nearby.offers = [priced(1, 150), priced(2, 900, { category: "FLOWERS" as never })];
    renderPage();
    openPanel();
    type("От", "500"); // дешевле 500 — только еда; с ценой от 500 еды не остаётся
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: /^Еда\s*0$/ })).toBeDisabled();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: /^Цветы\s*1$/ })).toBeEnabled();
  });

  it("a range inside the real limits that still matches nothing cannot be applied (the button says so)", () => {
    nearby.offers = [priced(1, 150), priced(2, 900)];
    renderPage();
    openPanel();
    type("От", "300");
    type("До", "600");
    expect(screen.getByRole("button", { name: "Ничего не найдено" })).toBeDisabled();
  });

  it("closing without applying discards the draft; the next opening starts from what is applied", () => {
    nearby.offers = [priced(1, 150), priced(2, 450)];
    renderPage();
    openPanel();
    type("От", "300");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Показать на карте/ })).toHaveLength(2);
    openPanel();
    expect(screen.getByLabelText("От")).toHaveValue("");
  });

  it("category from the panel and the tab bar are the same filter", () => {
    nearby.offers = [priced(1, 150), priced(2, 450, { category: "FLOWERS" as never })];
    renderPage();
    openPanel();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Цветы/ }));
    fireEvent.click(screen.getByRole("button", { name: /Показать 1/ }));
    expect(screen.getByRole("tab", { name: "Цветы" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Фильтры, включено: 1" })).toBeInTheDocument();
  });

  it("with no result, 'Сбросить фильтры' brings everything back, hot filter included", () => {
    nearby.offers = [priced(1, 150)];
    renderPage();
    openPanel();
    type("От", "150");
    fireEvent.click(screen.getByRole("button", { name: /Показать 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Горящие" }));
    expect(screen.getByText("По выбранным фильтрам ничего не нашлось.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(screen.getAllByRole("button", { name: /Показать на карте/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Сбросить фильтр по цене/ })).toBeNull();
  });
});
