import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import "../i18n";
import { OrderSummaryCard } from "./OrderSummaryCard";
import { ThemeProvider } from "../theme/ThemeProvider";
import type { BusinessState } from "../hooks/useBusiness";

const at = (h: number) => new Date(2026, 9, 4, h, 0).toISOString();
const OFFER = { id: "o1", title: "Шаурма классическая", category: "FOOD", discountedPrice: 12800, pickupStart: at(17), pickupEnd: at(19), ingredients: "Лаваш, говядина", allergens: ["gluten", "eggs"], allergensDeclared: true, bestBefore: at(23) } as never;
const BUSINESS = { id: "b1", name: "Shava Point", address: "Невский проспект, 40", lat: 1, lng: 2 } as never;

const renderSummary = (venue: BusinessState, onRetryVenue = jest.fn(), offer: unknown = OFFER) =>
  render(
    <ThemeProvider>
      <OrderSummaryCard offer={offer as never} quantity={1} venue={venue} onRetryVenue={onRetryVenue} />
    </ThemeProvider>
  );

describe("OrderSummaryCard (pre-payment receipt)", () => {
  it("shows what, where, when and how much before the person pays", () => {
    const view = renderSummary({ status: "ready", business: BUSINESS });
    expect(view.getByText("Шаурма классическая")).toBeTruthy();
    expect(view.getByText("Shava Point")).toBeTruthy();
    expect(view.getByText(/Невский проспект, 40/)).toBeTruthy();
    expect(view.getByText("Забрать: 17:00–19:00")).toBeTruthy();
    expect(view.getByText("Количество")).toBeTruthy();
    expect(view.getByText("128 ₽")).toBeTruthy();
  });

  it("does not block on the venue: loading and failed states still show the price and window", () => {
    const loading = renderSummary({ status: "loading" });
    expect(loading.getByText("Загрузка...")).toBeTruthy();
    expect(loading.getByText("128 ₽")).toBeTruthy();
    loading.unmount();

    const onRetry = jest.fn();
    const failed = renderSummary({ status: "failed" }, onRetry);
    expect(failed.getByText("Адрес пока не загрузился")).toBeTruthy();
    expect(failed.getByText("Забрать: 17:00–19:00")).toBeTruthy();
    fireEvent.press(failed.getByRole("button", { name: "Повторить" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("names the allergens and the best-before date right above the total", () => {
    const view = renderSummary({ status: "ready", business: BUSINESS });
    expect(view.getByText("Аллергены: глютен (злаки), яйца")).toBeTruthy();
    expect(view.getByText(/Годен до 4 окт\.?,? 23:00/)).toBeTruthy();
  });

  it("says 'no allergens' explicitly when the venue declared none", () => {
    const view = renderSummary({ status: "ready", business: BUSINESS }, jest.fn(), { ...(OFFER as object), allergens: [] });
    expect(view.getByText("Аллергенов нет")).toBeTruthy();
  });

  it("a legacy offer without info says to ask the venue instead of staying silent", () => {
    const view = renderSummary({ status: "ready", business: BUSINESS }, jest.fn(), { id: "o1", title: "Старый", category: "FOOD", discountedPrice: 100, pickupStart: at(17), pickupEnd: at(19) });
    expect(view.getByText("Состав и аллергены не указаны — уточните у заведения")).toBeTruthy();
  });

  it("flowers have no food lines at all", () => {
    const view = renderSummary({ status: "ready", business: BUSINESS }, jest.fn(), { id: "o1", title: "Букет", category: "FLOWERS", discountedPrice: 100, pickupStart: at(17), pickupEnd: at(19) });
    expect(view.queryByText(/Аллерген|Состав и аллергены/)).toBeNull();
  });
});
