import React from "react";
import { render } from "@testing-library/react-native";
import i18n from "../../i18n";
import { OfferCategory } from "@apetite/shared";
import { FoodInfoCard } from "./FoodInfoCard";
import { ThemeProvider } from "../../theme/ThemeProvider";

const BEST_BEFORE = new Date(2026, 9, 5, 22, 0).toISOString();
const full = { category: OfferCategory.FOOD, ingredients: "Лаваш, курица, огурцы, соус", allergens: ["gluten", "milk"], allergensDeclared: true, bestBefore: BEST_BEFORE };
const mount = (offer: Parameters<typeof FoodInfoCard>[0]["offer"]) => render(<ThemeProvider><FoodInfoCard offer={offer} /></ThemeProvider>);

afterEach(() => i18n.changeLanguage("ru"));

describe("FoodInfoCard", () => {
  it("shows ingredients, every allergen by name and the best-before date", () => {
    const view = mount(full);
    expect(view.getByText("Состав и срок годности")).toBeTruthy();
    expect(view.getByText("Лаваш, курица, огурцы, соус")).toBeTruthy();
    expect(view.getByText("глютен (злаки)")).toBeTruthy();
    expect(view.getByText("молоко и лактоза")).toBeTruthy();
    expect(view.getByText(/Годен до 5 окт\.?,? 22:00/)).toBeTruthy();
  });

  it("allergens are announced as one list for screen readers", () => {
    const view = mount(full);
    expect(view.getByLabelText("Аллергены: глютен (злаки), молоко и лактоза")).toBeTruthy();
  });

  it("'no allergens' is stated explicitly, not left blank", () => {
    const view = mount({ ...full, allergens: [] });
    expect(view.getByText("Аллергенов нет — по данным заведения")).toBeTruthy();
  });

  it("a legacy offer without info does not pretend there are no allergens: it asks to check with the venue", () => {
    const view = mount({ category: OfferCategory.FOOD });
    expect(view.getByText("Заведение не указало состав и аллергены. Уточните у заведения до покупки.")).toBeTruthy();
    expect(view.queryByText(/Аллергенов нет/)).toBeNull();
  });

  it("renders nothing for flowers", () => {
    const view = mount({ category: OfferCategory.FLOWERS });
    expect(view.toJSON()).toBeNull();
  });

  it("speaks English", async () => {
    await i18n.changeLanguage("en");
    const view = mount(full);
    expect(view.getByText("Ingredients and shelf life")).toBeTruthy();
    expect(view.getByText("gluten (cereals)")).toBeTruthy();
    expect(view.getByText(/Best before/)).toBeTruthy();
  });
});
