import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FoodInfo } from "./FoodInfo";

const full = { category: "FOOD" as never, ingredients: "Лаваш, курица, огурцы", allergens: ["gluten", "eggs"], allergensDeclared: true, bestBefore: "2026-10-05T19:00:00Z" };

describe("FoodInfo", () => {
  it("shows ingredients, every allergen by its Russian name and the best-before date", () => {
    render(<FoodInfo offer={full} />);
    expect(screen.getByText("Лаваш, курица, огурцы")).toBeInTheDocument();
    expect(screen.getByText("Глютен (злаки)")).toBeInTheDocument();
    expect(screen.getByText("Яйца")).toBeInTheDocument();
    expect(screen.getByText(/окт/)).toBeInTheDocument();
  });

  it("allergens are one named list for screen readers", () => {
    render(<FoodInfo offer={full} />);
    expect(screen.getByRole("list", { name: "Аллергены: Глютен (злаки), Яйца" })).toBeInTheDocument();
  });

  it("says 'no allergens' explicitly when the venue declared none", () => {
    render(<FoodInfo offer={{ ...full, allergens: [] }} />);
    expect(screen.getByText("Аллергенов нет — по данным заведения")).toBeInTheDocument();
  });

  it("asks to check with the venue when nothing was declared — never implies there are no allergens", () => {
    render(<FoodInfo offer={{ category: "FOOD" as never }} />);
    expect(screen.getByText(/Заведение не указало состав и аллергены/)).toBeInTheDocument();
    expect(screen.queryByText(/Аллергенов нет/)).not.toBeInTheDocument();
  });

  it("is absent for flowers", () => {
    const { container } = render(<FoodInfo offer={{ category: "FLOWERS" as never }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
