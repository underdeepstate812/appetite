import React from "react";
import { render } from "@testing-library/react-native";
import { OrderStatusTimeline } from "./OrderStatusTimeline";
import { ThemeProvider } from "../theme/ThemeProvider";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key),
  }),
}));

const NOW = new Date("2026-01-01T12:00:00.000Z").getTime();
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

function renderTimeline(props: { pickupStart: string; pickupEnd: string; acceptedAt?: string | null }) {
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  return render(
    <ThemeProvider>
      <OrderStatusTimeline {...props} />
    </ThemeProvider>
  );
}

describe("OrderStatusTimeline", () => {
  afterEach(() => jest.restoreAllMocks());

  // До подтверждения заведением шкала обязана честно стоять на "Оплачено" и не выдумывать
  // процент готовности — иначе прямое противоречие с ещё активной кнопкой "Отменить заказ"
  // на OrderDetailScreen (один и тот же экран одновременно утверждает "уже готовят" и
  // предлагает отменить то, что "уже готовят").
  it("waits honestly on 'confirmed' before the business accepts the order — no fake readiness percentage", () => {
    const view = renderTimeline({ pickupStart: at(30), pickupEnd: at(180) });

    expect(view.getByText(/orderStatus.waitingAcceptanceHint/)).toBeTruthy();
    expect(view.queryByText(/^\d+%$/)).toBeNull();
  });

  it("shows the readiness percentage once accepted, counted from acceptedAt — not from the payment moment", () => {
    const view = renderTimeline({ acceptedAt: at(-30), pickupStart: at(30), pickupEnd: at(180) });

    expect(view.getByText("50%")).toBeTruthy();
    expect(view.getByText(/orderStatus.preparingHintMinutes/)).toBeTruthy();
  });

  it("lists the three stages of the pickup route", () => {
    const view = renderTimeline({ acceptedAt: at(-30), pickupStart: at(30), pickupEnd: at(180) });

    for (const stage of ["confirmed", "preparing", "ready"]) {
      expect(view.getByText(`orderStatus.${stage}`)).toBeTruthy();
    }
  });

  it("is 100% ready with the pickup deadline once the window has opened", () => {
    const view = renderTimeline({ acceptedAt: at(-90), pickupStart: at(-10), pickupEnd: at(140) });

    expect(view.getByText("100%")).toBeTruthy();
    expect(view.getByText(/orderStatus.readyHint/)).toBeTruthy();
  });

  // Если окно самовывоза уже открылось, заказ показывается готовым даже без acceptedAt —
  // на практике такого не бывает (заведение успевает принять заказ заранее), но шкала не
  // должна тут провисать в "Оплачено" просто потому, что acceptedAt не пришёл с бэкенда.
  it("still reaches 'ready' once the pickup window opens even without acceptedAt", () => {
    const view = renderTimeline({ pickupStart: at(-10), pickupEnd: at(140) });

    expect(view.getByText("100%")).toBeTruthy();
    expect(view.getByText(/orderStatus.readyHint/)).toBeTruthy();
  });
});
