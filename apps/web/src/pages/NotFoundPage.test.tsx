import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotFoundPage } from "./NotFoundPage";
import { usePageTitle } from "../hooks/usePageTitle";

function TitleProbe({ title }: { title: string }) {
  usePageTitle(title);
  return null;
}

describe("NotFoundPage", () => {
  it("explains the problem and offers a way home", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Такой страницы нет" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "На главную" })).toHaveAttribute("href", "/");
  });

  it("sets its own document title", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(document.title).toBe("Страница не найдена — Appetite");
  });
});

describe("usePageTitle", () => {
  it("sets the title while mounted and restores the previous one on unmount", () => {
    document.title = "Главная";
    const view = render(<TitleProbe title="Вход — Appetite" />);
    expect(document.title).toBe("Вход — Appetite");

    view.unmount();
    expect(document.title).toBe("Главная");
  });
});
