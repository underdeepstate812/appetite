import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import "../../i18n";
import { AccessibilityInfo } from "react-native";
import { OfferPoster, ROTATE_MS, pickPosterOffers } from "./OfferPoster";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { offersApi } from "../../api/offers";

jest.mock("../../api/offers", () => ({ offersApi: { nearby: jest.fn() } }));
const nearby = offersApi.nearby as jest.Mock;

const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const offer = (over: Record<string, unknown> = {}) => ({
  id: "o1", businessId: "b1", title: "Пицца дня", category: "FOOD", originalPrice: 100000, discountedPrice: 30000, discountPercent: 70,
  baseDiscountPercent: 70, quantityTotal: 5, quantityLeft: 5, weightKg: 1, pickupStart: hours(-1), pickupEnd: hours(23.5), status: "ACTIVE",
  featured: true, businessName: "JoyPizza", businessAddress: "x", businessLat: 1, businessLng: 1, distanceKm: 1, ...over,
});
const renderPoster = (onSceneChange?: (scene: { heat: number | null }) => void) => render(<ThemeProvider><OfferPoster onSceneChange={onSceneChange} /></ThemeProvider>);
const two = () => [offer(), offer({ id: "o2", businessId: "b2", title: "Паста", businessName: "Uno", featured: false, pickupEnd: hours(0.4), discountPercent: 50 })];

beforeEach(() => nearby.mockReset());

describe("pickPosterOffers", () => {
  it("puts the deal of the day first and takes one offer per venue", () => {
    const picked = pickPosterOffers([
      offer({ id: "calm", businessId: "b2", featured: false, pickupEnd: hours(5), discountPercent: 40, title: "Спокойный" }),
      offer({ id: "dup", businessId: "b1", featured: false, pickupEnd: hours(1), discountPercent: 70, title: "Второй у того же" }),
      offer(),
      offer({ id: "c", businessId: "b3", featured: false, pickupEnd: hours(2), discountPercent: 50 }),
      offer({ id: "d", businessId: "b4", featured: false, pickupEnd: hours(3), discountPercent: 45 }),
    ] as never);
    expect(picked.map((o) => o.id)).toEqual(["o1", "c", "d", "calm"]);
  });

  it("lets up to six venues pass by", () => {
    const many = Array.from({ length: 9 }, (_, i) => offer({ id: `x${i}`, businessId: `bx${i}`, featured: false, pickupEnd: hours(2 + i), discountPercent: 50 }));
    expect(pickPosterOffers(many as never)).toHaveLength(6);
  });

  it("skips sold-out and expired offers", () => {
    expect(pickPosterOffers([offer({ quantityLeft: 0 }), offer({ id: "late", pickupEnd: hours(-1) })] as never)).toEqual([]);
  });
});

describe("OfferPoster", () => {
  it("shows the real discount as a giant number with the dish, the venue and the time left", async () => {
    nearby.mockResolvedValue([offer()]);
    const view = renderPoster();
    await waitFor(() => expect(view.getByText("Пицца дня")).toBeTruthy());
    expect(view.getByText("Предложение дня")).toBeTruthy();
    expect(view.getByText(/JoyPizza · ещё 23 ч/)).toBeTruthy();
    // Цифра скрыта от скринридеров (они читают одну фразу целиком), но на экране она есть. Она «набегает» 900 мс, поэтому ждём
    // с запасом: стандартная секунда не выдерживала нагруженную машину (тест то проходил, то нет).
    await waitFor(() => expect(view.getByText("−70", { includeHiddenElements: true })).toBeTruthy(), { timeout: 4000 });
  });

  it("describes the whole poster to screen readers in one sentence", async () => {
    nearby.mockResolvedValue([offer()]);
    const view = renderPoster();
    await waitFor(() => expect(view.getByLabelText(/Предложение дня: Пицца дня, JoyPizza, −70%, ещё 23 ч/)).toBeTruthy());
  });

  it("has no next-offer affordance when there is a single offer", async () => {
    nearby.mockResolvedValue([offer()]);
    const view = renderPoster();
    await waitFor(() => expect(view.getByText("Пицца дня")).toBeTruthy());
    expect(view.queryByRole("button")).toBeNull();
  });

  it("moves to the next offer on tap when there are several", async () => {
    nearby.mockResolvedValue([offer(), offer({ id: "o2", businessId: "b2", title: "Паста", businessName: "Uno", featured: false, pickupEnd: hours(2), discountPercent: 50 })]);
    const view = renderPoster();
    await waitFor(() => expect(view.getByText("Пицца дня")).toBeTruthy());
    const poster = view.getByRole("button", { name: /Нажмите, чтобы увидеть следующее/ });
    act(() => fireEvent.press(poster));
    await waitFor(() => expect(view.getByText("Паста")).toBeTruthy());
    expect(view.queryByText("Пицца дня")).toBeNull();
  });

  it("falls back to a static promise in the same box when the API fails or is empty", async () => {
    nearby.mockRejectedValue(new Error("offline"));
    const failed = renderPoster();
    await waitFor(() => expect(failed.getByText(/Скидки до 70%/)).toBeTruthy());
    nearby.mockResolvedValue([]);
    const empty = renderPoster();
    await waitFor(() => expect(empty.getByText(/Скидки до 70%/)).toBeTruthy());
  });

  it("falls back with no heat for the sky when there is nothing to show", async () => {
    nearby.mockResolvedValue([]);
    const onScene = jest.fn();
    const view = renderPoster(onScene);
    await waitFor(() => expect(view.getByText(/Скидки до 70%/)).toBeTruthy());
    expect(onScene).not.toHaveBeenCalledWith(expect.objectContaining({ heat: expect.any(Number) }));
  });

  it("tells the sky how hot the shown offer is (the deal of the day is warm, a closing offer is hotter)", async () => {
    nearby.mockResolvedValue(two());
    const onScene = jest.fn();
    const view = renderPoster(onScene);
    await waitFor(() => expect(view.getByText("Пицца дня")).toBeTruthy());
    const first = onScene.mock.calls.at(-1)?.[0].heat;
    expect(first).toBeGreaterThan(0.5);
    act(() => fireEvent.press(view.getByRole("button", { name: /Нажмите, чтобы увидеть следующее/ })));
    await waitFor(() => expect(view.getByText("Паста")).toBeTruthy());
    const second = onScene.mock.calls.at(-1)?.[0].heat;
    expect(second).toBeGreaterThan(first);
  });
});

describe("OfferPoster: offers pass by quickly", () => {
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("goes to the next real offer on its own every ~3 seconds and wraps around", async () => {
    nearby.mockResolvedValue(two());
    const view = renderPoster();
    await flush();
    expect(view.getByText("Пицца дня")).toBeTruthy();
    expect(ROTATE_MS).toBeLessThanOrEqual(3500);
    await act(async () => void jest.advanceTimersByTime(ROTATE_MS + 50));
    expect(view.getByText("Паста")).toBeTruthy();
    expect(view.queryByText("Пицца дня")).toBeNull();
    await act(async () => void jest.advanceTimersByTime(ROTATE_MS + 50));
    expect(view.getByText("Пицца дня")).toBeTruthy();
  });

  it("stands still while the poster is held under a finger, and goes on after release", async () => {
    nearby.mockResolvedValue(two());
    const view = renderPoster();
    await flush();
    const poster = view.getByRole("button", { name: /Нажмите, чтобы увидеть следующее/ });
    act(() => void fireEvent(poster, "pressIn"));
    await act(async () => void jest.advanceTimersByTime(ROTATE_MS * 3));
    expect(view.getByText("Пицца дня")).toBeTruthy();
    act(() => void fireEvent(poster, "pressOut"));
    await act(async () => void jest.advanceTimersByTime(ROTATE_MS + 50));
    expect(view.getByText("Паста")).toBeTruthy();
  });

  it("does not move by itself when the system asks to reduce motion, but a tap still works", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    nearby.mockResolvedValue(two());
    const view = renderPoster();
    await flush();
    await act(async () => void jest.advanceTimersByTime(ROTATE_MS * 3));
    expect(view.getByText("Пицца дня")).toBeTruthy();
    act(() => void fireEvent.press(view.getByRole("button", { name: /Нажмите, чтобы увидеть следующее/ })));
    expect(view.getByText("Паста")).toBeTruthy();
  });
});
