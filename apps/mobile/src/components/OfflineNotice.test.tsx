import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import i18n from "../i18n";
import { OfflineNotice } from "./OfflineNotice";
import { ThemeProvider } from "../theme/ThemeProvider";

const SAVED = new Date(2026, 9, 4, 12, 22).toISOString();
const mount = (kind: "ticket" | "ticketExpired" | "list", savedAt: string | null = SAVED, onRetry = jest.fn()) =>
  ({ onRetry, view: render(<ThemeProvider><OfflineNotice kind={kind} savedAt={savedAt} onRetry={onRetry} /></ThemeProvider>) });

afterEach(() => i18n.changeLanguage("ru"));

describe("OfflineNotice", () => {
  it("tells the person the ticket is real and can be shown at the counter", () => {
    const { view } = mount("ticket");
    expect(view.getByText("Нет сети")).toBeTruthy();
    expect(view.getByText("Показан сохранённый билет — код можно показать кассиру. Статус мог измениться.")).toBeTruthy();
    expect(view.getByText("Сохранено в 12:22")).toBeTruthy();
  });

  it("does not claim the code can be shown once the pickup time is over", () => {
    const { view } = mount("ticketExpired");
    expect(view.getByText("Показан сохранённый билет. Время самовывоза истекло, статус мог измениться.")).toBeTruthy();
    expect(view.queryByText(/можно показать кассиру/)).toBeNull();
  });

  it("for the list warns that statuses may be stale", () => {
    const { view } = mount("list");
    expect(view.getByText("Показан сохранённый список. Статусы могли устареть.")).toBeTruthy();
  });

  it("is announced to screen readers and can be refreshed", () => {
    const { view, onRetry } = mount("ticket");
    expect(view.getByRole("alert")).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Обновить" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the time when it is unknown", () => {
    const { view } = mount("ticket", null);
    expect(view.queryByText(/Сохранено в/)).toBeNull();
  });

  it("speaks English", async () => {
    await i18n.changeLanguage("en");
    const { view } = mount("ticket");
    expect(view.getByText("No connection")).toBeTruthy();
    expect(view.getByRole("button", { name: "Refresh" })).toBeTruthy();
  });
});
