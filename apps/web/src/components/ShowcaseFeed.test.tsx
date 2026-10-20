import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { NearbyOffer } from "@apetite/shared";
import { MAX_FEED_CARDS, ShowcaseFeed, plural } from "./ShowcaseFeed";

const NOW = Date.parse("2026-10-06T12:00:00Z");

const offer = (n: number, over: Partial<NearbyOffer> = {}): NearbyOffer =>
  ({
    id: `o${n}`, title: `Блюдо ${n}`, businessName: `Кафе ${n}`, category: "FOOD", discountPercent: 50, originalPrice: 40000, discountedPrice: 20000,
    pickupStart: new Date(NOW - 3600_000).toISOString(), pickupEnd: new Date(NOW + 5 * 3600_000).toISOString(), distanceKm: 0.4, quantityLeft: 3, featured: false,
    imageUrl: null, ...over,
  }) as unknown as NearbyOffer;

function setup(over: Partial<React.ComponentProps<typeof ShowcaseFeed>> = {}) {
  const props: React.ComponentProps<typeof ShowcaseFeed> = {
    offers: [offer(1), offer(2)], now: NOW, loading: false, error: null, onRetry: vi.fn(), category: "all", onCategory: vi.fn(), onlyHot: false,
    onOnlyHot: vi.fn(), minRub: null, maxRub: null, onApplyFilters: vi.fn(), onResetFilters: vi.fn(), allOffers: null, selectedId: null, onSelect: vi.fn(), onShowMap: vi.fn(), geo: { status: "idle", located: false, outside: false }, sort: "hot", onSort: vi.fn(),
    onLocate: vi.fn(), onResetGeo: vi.fn(), showGeoPrompt: false, onDismissGeoPrompt: vi.fn(), ...over,
  };
  render(<ShowcaseFeed {...props} />);
  return props;
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

describe("plural", () => {
  it("declines 'предложение' the Russian way", () => {
    expect([1, 2, 5, 11, 12, 21, 24, 54, 100].map(plural)).toEqual(["предложение", "предложения", "предложений", "предложений", "предложений", "предложение", "предложения", "предложения", "предложений"]);
  });
});

describe("ShowcaseFeed", () => {
  it("announces the live showcase with the offer count and the geo status", () => {
    setup();
    expect(screen.getByText("Сейчас на витрине")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2 предложения");
    expect(screen.getByRole("status")).toHaveTextContent("Весь Санкт-Петербург");
  });

  it("shows one card per offer with price, shop and discount, plus the 'all on the map' end card", () => {
    setup();
    const list = screen.getByRole("list", { name: "Предложения" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3); // 2 карточки + «Все на карте»
    const first = within(list).getByRole("button", { name: /Блюдо 1, Кафе 1/ });
    expect(first).toHaveTextContent("−50%");
    expect(first).toHaveTextContent("200 ₽");
    expect(first).toHaveTextContent("400 ₽");
    expect(screen.getByRole("button", { name: /Все на карте/ })).toBeInTheDocument();
  });

  it("caps the feed and tells how many more are on the map", () => {
    const many = Array.from({ length: MAX_FEED_CARDS + 5 }, (_, i) => offer(i + 1));
    setup({ offers: many });
    expect(screen.getAllByRole("button", { name: /Показать на карте/ })).toHaveLength(MAX_FEED_CARDS);
    expect(screen.getByRole("button", { name: /Ещё 5 на карте/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("21 предложение");
  });

  it("tapping a card selects that offer; the end card scrolls to the map", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Блюдо 2, Кафе 2/ }));
    expect(props.onSelect).toHaveBeenCalledWith("o2");
    fireEvent.click(screen.getByRole("button", { name: /Все на карте/ }));
    expect(props.onShowMap).toHaveBeenCalledTimes(1);
  });

  it("marks the selected card as pressed", () => {
    setup({ selectedId: "o1" });
    expect(screen.getByRole("button", { name: /Блюдо 1, Кафе 1/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Блюдо 2, Кафе 2/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("flags hot offers and the offer of the day", () => {
    const hot = offer(1, { pickupEnd: new Date(NOW + 30 * 60_000).toISOString() });
    const featured = offer(2, { featured: true, pickupEnd: new Date(NOW + 24 * 3600_000).toISOString() });
    setup({ offers: [featured, hot, offer(3)] });
    expect(screen.getByText("Предложение дня")).toBeInTheDocument();
    expect(screen.getAllByText("Горит")).toHaveLength(1);
    expect(screen.getByText("30 мин")).toBeInTheDocument();
  });

  it("category tabs and the hot toggle report changes", () => {
    const props = setup();
    expect(screen.getByRole("tab", { name: "Все" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Выпечка" }));
    expect(props.onCategory).toHaveBeenCalledWith("BAKERY");
    fireEvent.click(screen.getByRole("button", { name: /Горящие/ }));
    expect(props.onOnlyHot).toHaveBeenCalledTimes(1);
  });


  it("shows skeletons while loading, not the empty state", () => {
    setup({ offers: null, loading: true });
    expect(document.querySelectorAll(".show-card-skeleton")).toHaveLength(5);
    expect(screen.queryByText(/пока нет/)).toBeNull();
  });

  it("an empty result under active filters says so and offers to reset them; with no filters it just says there is nothing yet", () => {
    const props = setup({ offers: [], onlyHot: true });
    expect(screen.getByText("По выбранным фильтрам ничего не нашлось.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(props.onResetFilters).toHaveBeenCalledTimes(1);
  });

  it("without filters an empty showcase is not blamed on filters", () => {
    setup({ offers: [] });
    expect(screen.getByText("Предложений пока нет.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сбросить фильтры" })).toBeNull();
  });

  it("an active price filter is visible as a removable chip, and the filters button shows how many filters are on", () => {
    const props = setup({ minRub: 100, maxRub: 500 });
    expect(screen.getByRole("button", { name: "Фильтры, включено: 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Сбросить фильтр по цене: 100–500 ₽/ }));
    expect(props.onApplyFilters).toHaveBeenCalledWith({ category: "all", minRub: null, maxRub: null });
  });

  it("an error replaces the feed with a retry button", () => {
    const props = setup({ offers: null, error: "Нет связи с сервером" });
    expect(screen.getByRole("alert")).toHaveTextContent("Нет связи с сервером");
    fireEvent.click(screen.getByRole("button", { name: /Повторить/ }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });
});
