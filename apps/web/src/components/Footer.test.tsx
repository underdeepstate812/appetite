import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("renders the brand lockup and every nav column", () => {
    render(<Footer />);

    // "Appetite" появляется дважды: видимый логотип и aria-hidden призрак-вотермарк
    // (.footer-ghost-mark) — берём именно логотип по селектору.
    expect(screen.getByText("Appetite", { selector: ".footer-logo" })).toBeInTheDocument();
    expect(screen.getByText("Продукт")).toBeInTheDocument();
    expect(screen.getByText("Аккаунт")).toBeInTheDocument();
    expect(screen.getByText("Контакты")).toBeInTheDocument();
  });

  it("links every nav item to its real destination", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "Как это работает" })).toHaveAttribute("href", "#how");
    expect(screen.getByRole("link", { name: "Для бизнеса" })).toHaveAttribute("href", "/for-business");
    expect(screen.getByRole("link", { name: "Вопросы" })).toHaveAttribute("href", "#faq");
    expect(screen.getByRole("link", { name: "Войти" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Регистрация" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "hello@apetite.ru" })).toHaveAttribute(
      "href",
      "mailto:hello@apetite.ru"
    );
  });

  it("shows the current year in the copyright line", () => {
    render(<Footer />);

    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`© ${year} Appetite`))).toBeInTheDocument();
  });
});
