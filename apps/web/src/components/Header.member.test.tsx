import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderStatus } from "@apetite/shared";

const ordersList = vi.fn();
vi.mock("../api/orders", () => ({ ordersApi: { list: () => ordersList() } }));
vi.mock("../store/auth", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Анна Петрова", email: "anna@example.ru", phone: null, role: "USER" }, isHydrated: true }),
  authActions: { logout: vi.fn().mockResolvedValue(undefined) },
}));

import { Header } from "./Header";
import { grantOneClickConsent, hasOneClickConsent, revokeOneClickConsent } from "../utils/paymentPrefs";

const renderHeader = () => render(<MemoryRouter initialEntries={["/home"]}><Header /></MemoryRouter>);
const panel = () => within(document.querySelector(".mobile-menu") as HTMLElement);

beforeEach(() => {
  ordersList.mockReset().mockResolvedValue([]);
  revokeOneClickConsent();
});

describe("Header: вошедший пользователь", () => {
  it("в навигации только покупательское: Витрина и Мои заказы — без лендинга и «Для бизнеса»", () => {
    renderHeader();
    const nav = within(document.querySelector(".site-nav-desktop") as HTMLElement);
    expect(nav.getAllByRole("link").map((a) => a.textContent)).toEqual(["Витрина", "Мои заказы"]);
    expect(nav.getByRole("link", { name: "Витрина" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText("Для бизнеса")).toBeNull();
    expect(screen.queryByText("Как это работает")).toBeNull();
    expect(screen.queryByText("Вопросы")).toBeNull();
  });

  it("логотип ведёт на витрину, а не на лендинг", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: /Appetite/ })).toHaveAttribute("href", "/home");
  });

  it("мобильная панель — личный кабинет: имя, email, Витрина, Мои заказы, Выйти; без «Для бизнеса»", () => {
    renderHeader();
    const p = panel();
    expect(p.getByText("Анна Петрова")).toBeInTheDocument();
    expect(p.getByText("anna@example.ru")).toBeInTheDocument();
    expect(p.getByRole("link", { name: /Витрина/ })).toHaveAttribute("href", "/home");
    expect(p.getByRole("link", { name: /Мои заказы/ })).toHaveAttribute("href", "/orders");
    expect(p.getByRole("link", { name: /Профиль и настройки/ })).toHaveAttribute("href", "/profile");
    expect(p.getByRole("button", { name: /Выйти/ })).toBeInTheDocument();
    expect(p.queryByText(/бизнес/i)).toBeNull();
    expect(p.queryByRole("link", { name: /Войти/ })).toBeNull();
  });

  it("бейдж: заказ ждёт самовывоза и неподтверждённое получение считаются; подпись под «Мои заказы»", async () => {
    ordersList.mockResolvedValue([
      { status: OrderStatus.CONFIRMED, receiptConfirmedAt: null, receiptDisputedAt: null },
      { status: OrderStatus.COMPLETED, receiptConfirmedAt: null, receiptDisputedAt: null },
      { status: OrderStatus.CANCELLED },
    ]);
    renderHeader();
    await waitFor(() => expect(panel().getByLabelText("Требуют внимания: 2")).toBeInTheDocument());
    expect(panel().getByText("1 заказ ждёт самовывоза · подтвердите получение")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Открыть меню/ })).toHaveClass("has-attention");
  });

  it("ошибка загрузки заказов не ломает шапку: бейджа просто нет", async () => {
    ordersList.mockRejectedValue(new Error("offline"));
    renderHeader();
    await waitFor(() => expect(ordersList).toHaveBeenCalled());
    expect(panel().queryByLabelText(/Требуют внимания/)).toBeNull();
    expect(screen.getByRole("button", { name: /Анна/ })).toBeInTheDocument();
  });

  describe("выпадающее меню на десктопе", () => {
    it("открывается: фокус на первом пункте, стрелки ходят по кругу, Esc закрывает и возвращает фокус на кнопку", async () => {
      const user = userEvent.setup();
      renderHeader();
      const button = screen.getByRole("button", { name: /Анна/ });
      await user.click(button);
      const menu = screen.getByRole("menu", { name: "Личный кабинет" });
      const items = within(menu).getAllByRole("menuitem");
      expect(items.map((i) => i.textContent)).toEqual([expect.stringContaining("Профиль и настройки"), expect.stringContaining("Мои заказы"), expect.stringContaining("Выйти")]);
      expect(items[0]).toHaveFocus();
      await user.keyboard("{ArrowDown}");
      expect(items[1]).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      expect(items[0]).toHaveFocus();
      await user.keyboard("{ArrowUp}");
      expect(items[2]).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("menu")).toBeNull();
      expect(button).toHaveFocus();
    });

    it("«Отключить заказ в 1 клик» появляется только при выданном согласии и снимает его", async () => {
      const user = userEvent.setup();
      grantOneClickConsent();
      renderHeader();
      await user.click(screen.getByRole("button", { name: /Анна/ }));
      await user.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: /Отключить заказ в 1 клик/ }));
      expect(hasOneClickConsent()).toBe(false);
      expect(within(screen.getByRole("menu")).queryByRole("menuitem", { name: /Отключить заказ/ })).toBeNull();
    });

    it("без согласия строки про «1 клик» нет", async () => {
      const user = userEvent.setup();
      renderHeader();
      await user.click(screen.getByRole("button", { name: /Анна/ }));
      expect(within(screen.getByRole("menu")).queryByText(/1 клик/)).toBeNull();
    });
  });
});
