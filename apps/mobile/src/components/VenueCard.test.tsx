import React from "react";
import { Linking } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import "../i18n";
import { VenueCard } from "./VenueCard";
import { ThemeProvider } from "../theme/ThemeProvider";
import type { BusinessState } from "../hooks/useBusiness";

const BUSINESS = { id: "b1", name: "Shava Point", address: "Невский проспект, 40", lat: 59.93, lng: 30.36 } as never;
const ready: BusinessState = { status: "ready", business: BUSINESS };
const at = (h: number) => new Date(2026, 9, 4, h, 0).toISOString();

const renderCard = (state: BusinessState, props: Partial<React.ComponentProps<typeof VenueCard>> = {}) => {
  const onRetry = jest.fn();
  const view = render(
    <ThemeProvider>
      <VenueCard state={state} onRetry={onRetry} pickupStart={at(17)} pickupEnd={at(19)} {...props} />
    </ThemeProvider>
  );
  return { view, onRetry };
};

// Linking.openURL в jest-expo уже мок: restoreAllMocks не обнуляет его счётчик вызовов, поэтому чистим явно.
beforeEach(() => jest.clearAllMocks());

describe("VenueCard", () => {
  it("answers 'where and when': venue, address and the pickup window", () => {
    const { view } = renderCard(ready);
    expect(view.getByText("Где забрать")).toBeTruthy();
    expect(view.getByText("Shava Point")).toBeTruthy();
    expect(view.getByText("Невский проспект, 40")).toBeTruthy();
    expect(view.getByText("Забрать: 17:00–19:00")).toBeTruthy();
  });

  it("opens the route to the venue in the maps app", () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { view } = renderCard(ready);
    fireEvent.press(view.getByRole("button", { name: "Построить маршрут до Shava Point" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toContain("59.93");
    expect(open.mock.calls[0][0]).toContain("30.36");
  });

  it("falls back to the browser map when no maps app can handle the link", async () => {
    const open = jest.spyOn(Linking, "openURL").mockRejectedValueOnce(new Error("no handler")).mockResolvedValue(true);
    const { view } = renderCard(ready);
    fireEvent.press(view.getByRole("button", { name: "Построить маршрут до Shava Point" }));
    await Promise.resolve();
    await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(2);
    expect(open.mock.calls[1][0]).toMatch(/^https:\/\/www\.openstreetmap\.org\//);
  });

  it("shows loading without a route button, so there is nothing to mis-tap", () => {
    const { view } = renderCard({ status: "loading" });
    expect(view.getByText("Загрузка...")).toBeTruthy();
    expect(view.queryByRole("button")).toBeNull();
  });

  it("offers a retry when the venue failed to load, and keeps the window visible", () => {
    const { view, onRetry } = renderCard({ status: "failed" });
    expect(view.getByText("Адрес пока не загрузился")).toBeTruthy();
    expect(view.getByText("Забрать: 17:00–19:00")).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Повторить" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides the route button for history entries and the pre-payment summary", () => {
    const { view } = renderCard(ready, { withRoute: false });
    expect(view.queryByRole("button")).toBeNull();
    expect(view.getByText("Shava Point")).toBeTruthy();
  });

  it("still offers a retry for a history entry whose address failed to load", () => {
    const { view, onRetry } = renderCard({ status: "failed" }, { withRoute: false });
    fireEvent.press(view.getByRole("button", { name: "Повторить" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("says 'tomorrow' when the window closes on the next day", () => {
    const { view } = renderCard(ready, { pickupStart: at(17), pickupEnd: new Date(2026, 9, 5, 17, 0).toISOString() });
    expect(view.getByText("Забрать: 17:00 — завтра 17:00")).toBeTruthy();
  });
});
