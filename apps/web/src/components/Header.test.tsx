import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Header } from "./Header";

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>
  );
}

function getMenuToggle() {
  return screen.getByRole("button", { name: /меню/i });
}

// Панель бургер-меню рендерится порталом в document.body, а не внутрь
// контейнера render() — .mobile-menu ищем напрямую в DOM.
function getMobileMenuPanel(): HTMLElement {
  const panel = document.querySelector(".mobile-menu");
  if (!panel) throw new Error(".mobile-menu panel not found in document.body");
  return panel as HTMLElement;
}

describe("Header", () => {
  it("renders the logo and every desktop nav link with the right destination", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: /Appetite/ })).toHaveAttribute("href", "/");

    const desktopNav = document.querySelector(".site-nav-desktop");
    expect(desktopNav).not.toBeNull();
    const nav = within(desktopNav as HTMLElement);
    expect(nav.getByRole("link", { name: "Как это работает" })).toHaveAttribute("href", "#how");
    expect(nav.getByRole("link", { name: "Для бизнеса" })).toHaveAttribute("href", "/for-business");
    expect(nav.getByRole("link", { name: "Вопросы" })).toHaveAttribute("href", "#faq");
  });

  it("starts with the hamburger menu closed", () => {
    renderHeader();

    const toggle = getMenuToggle();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAccessibleName("Открыть меню");
    expect(getMobileMenuPanel()).not.toHaveClass("is-open");
  });

  it("opens the mobile menu on click and closes it again on a second click", async () => {
    const user = userEvent.setup();
    renderHeader();
    const toggle = getMenuToggle();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Закрыть меню");
    expect(getMobileMenuPanel()).toHaveClass("is-open");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(getMobileMenuPanel()).not.toHaveClass("is-open");
  });

  it("closes the menu on Escape", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(getMenuToggle());
    expect(getMobileMenuPanel()).toHaveClass("is-open");

    await user.keyboard("{Escape}");
    expect(getMobileMenuPanel()).not.toHaveClass("is-open");
  });

  it("closes the menu on an outside click but not on a click inside the panel", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(getMenuToggle());
    expect(getMobileMenuPanel()).toHaveClass("is-open");

    // Клик внутри панели (например, мимо ссылок) не должен закрывать меню.
    fireEvent.mouseDown(getMobileMenuPanel());
    expect(getMobileMenuPanel()).toHaveClass("is-open");

    // Клик вне хедера и вне портала — должен закрыть.
    fireEvent.mouseDown(document.body);
    expect(getMobileMenuPanel()).not.toHaveClass("is-open");
  });

  it("lists every nav link plus a login link inside the mobile panel", () => {
    renderHeader();

    const panel = within(getMobileMenuPanel());
    expect(panel.getByRole("link", { name: /Как это работает/ })).toHaveAttribute("href", "#how");
    expect(panel.getByRole("link", { name: /Для бизнеса/ })).toHaveAttribute("href", "/for-business");
    expect(panel.getByRole("link", { name: /Вопросы/ })).toHaveAttribute("href", "#faq");
    expect(panel.getByRole("link", { name: /Войти/ })).toHaveAttribute("href", "/login");
  });

  it("closes the menu when a mobile link is clicked", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(getMenuToggle());
    expect(getMobileMenuPanel()).toHaveClass("is-open");

    const panel = within(getMobileMenuPanel());
    await user.click(panel.getByRole("link", { name: /Вопросы/ }));
    expect(getMobileMenuPanel()).not.toHaveClass("is-open");
  });
});
