import React from "react";
import { Linking } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "../../i18n";
import { SupportSheet } from "./SupportSheet";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { SUPPORT_EMAIL } from "../../utils/support";

const ORDER = { id: "cm1x9k2ab00004hq7z3d5f9a2b", title: "Набор десертов дня", venue: "Кафе Пушкинъ", totalPrice: 24000, createdAt: new Date(2026, 9, 4, 12, 22).toISOString() };

function mount(props: Partial<React.ComponentProps<typeof SupportSheet>> = {}) {
  const onClose = jest.fn();
  const element = (p: Partial<React.ComponentProps<typeof SupportSheet>>) => (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <SupportSheet visible onClose={onClose} order={ORDER} {...p} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
  const view = render(element(props));
  return { view, onClose, rerender: (p: Partial<React.ComponentProps<typeof SupportSheet>>) => view.rerender(element({ ...props, ...p })) };
}

const sentUrl = (open: jest.SpyInstance) => String(open.mock.calls[open.mock.calls.length - 1][0]);
const params = (url: string) => new URLSearchParams(url.split("?")[1]);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(async () => {
  jest.useRealTimers();
  await i18n.changeLanguage("ru");
});

describe("SupportSheet", () => {
  it("names the order it is about, so the person does not have to explain which one", () => {
    const { view } = mount();
    expect(view.getByText("Нужна помощь?")).toBeTruthy();
    expect(view.getByText("Заказ №5F9A2B · Набор десертов дня")).toBeTruthy();
    expect(view.getByText(SUPPORT_EMAIL)).toBeTruthy();
    expect(view.getByText("Отменить заказ после оплаты можно только через поддержку.")).toBeTruthy();
  });

  it("opens a letter with the order number, offer, venue, amount and the chosen topic already written", () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { view } = mount();
    fireEvent.press(view.getByRole("radio", { name: "Заведение закрыто или нет товара" }));
    fireEvent.press(view.getByRole("button", { name: "Написать на почту" }));

    const url = sentUrl(open);
    expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?`)).toBe(true);
    const mail = params(url);
    expect(mail.get("subject")).toBe("Appetite: помощь с заказом №5F9A2B");
    const body = mail.get("body") ?? "";
    expect(body).toContain("Тема: Заведение закрыто или нет товара");
    expect(body).toContain(`Заказ: №5F9A2B (ID: ${ORDER.id})`);
    expect(body).toContain("Предложение: Набор десертов дня");
    expect(body).toContain("Заведение: Кафе Пушкинъ");
    expect(body).toContain("Сумма: 240 ₽");
    expect(body).toMatch(/Оформлен: 4 октября/);
    expect(body.trimEnd().endsWith("Опишите, что случилось:")).toBe(true);
  });

  it("starts with the first topic selected and lets the person change it", () => {
    const { view } = mount();
    expect(view.getByRole("radio", { name: "Не могу забрать заказ" }).props.accessibilityState?.checked).toBe(true);
    fireEvent.press(view.getByRole("radio", { name: "Списана не та сумма" }));
    expect(view.getByRole("radio", { name: "Списана не та сумма" }).props.accessibilityState?.checked).toBe(true);
    expect(view.getByRole("radio", { name: "Не могу забрать заказ" }).props.accessibilityState?.checked).toBe(false);
  });

  it("leaves out lines it does not know instead of writing 'undefined'", () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { view } = mount({ order: { id: ORDER.id, totalPrice: 24000, createdAt: ORDER.createdAt } });
    fireEvent.press(view.getByRole("button", { name: "Написать на почту" }));
    const body = params(sentUrl(open)).get("body") ?? "";
    expect(body).not.toMatch(/undefined|Предложение:|Заведение:/);
    expect(body).toContain("Заказ: №5F9A2B");
  });

  it("works without an order (from the profile): general topics, no cancel note, general subject", () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { view } = mount({ order: undefined });
    expect(view.getByText("Выберите тему — мы подставим её в письмо")).toBeTruthy();
    expect(view.queryByText(/только через поддержку/)).toBeNull();
    expect(view.queryByRole("radio", { name: "Нужно отменить заказ" })).toBeNull();
    fireEvent.press(view.getByRole("button", { name: "Написать на почту" }));
    const mail = params(sentUrl(open));
    expect(mail.get("subject")).toBe("Appetite: помощь");
    expect(mail.get("body")).not.toMatch(/Заказ:/);
    expect(mail.get("body")).toContain("Тема: Вопрос по заказу");
  });

  it("when no mail app can open the letter, says so and shows the address to write to", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no mail app"));
    const { view } = mount();
    expect(view.queryByRole("alert")).toBeNull();
    fireEvent.press(view.getByRole("button", { name: "Написать на почту" }));
    await act(async () => {});
    expect(view.getByRole("alert")).toBeTruthy();
    expect(view.getByText(`Не удалось открыть почту. Напишите нам на ${SUPPORT_EMAIL}.`)).toBeTruthy();
  });

  it("forgets the previous topic and error when it is opened again", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no mail app"));
    const { view, rerender } = mount();
    fireEvent.press(view.getByRole("radio", { name: "Списана не та сумма" }));
    fireEvent.press(view.getByRole("button", { name: "Написать на почту" }));
    await act(async () => {});
    rerender({ visible: false });
    act(() => void jest.runAllTimers());
    rerender({ visible: true });
    expect(view.getByRole("radio", { name: "Не могу забрать заказ" }).props.accessibilityState?.checked).toBe(true);
    expect(view.queryByRole("alert")).toBeNull();
  });

  it("closes from the Close button", () => {
    const { view, onClose } = mount();
    fireEvent.press(view.getByRole("button", { name: "Закрыть", hidden: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it("writes the letter in English when the app is in English", async () => {
    await i18n.changeLanguage("en");
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { view } = mount();
    fireEvent.press(view.getByRole("button", { name: "Write by email" }));
    const mail = params(sentUrl(open));
    expect(mail.get("subject")).toBe("Appetite: help with order #5F9A2B");
    expect(mail.get("body")).toContain("Hello!");
    expect(mail.get("body")).toContain("Amount: 240 ₽");
  });
});
