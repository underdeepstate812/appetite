import React from "react";
import { render } from "@testing-library/react-native";
import { ECO_LEVELS, type EcoSummary } from "@apetite/shared";
import { EcoRoute } from "./EcoRoute";
import { ThemeProvider } from "../../theme/ThemeProvider";

// Без инициализированного i18n t() возвращает ключ — этого достаточно, чтобы проверить, какой текст выбран.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key),
  }),
}));

function summary(totalPoints: number, levelIndex: number): EcoSummary {
  return {
    totalPoints,
    totalWeightSavedKg: 0,
    ordersCompleted: 0,
    level: ECO_LEVELS[levelIndex],
    nextLevel: ECO_LEVELS[levelIndex + 1] ?? null,
  };
}

function renderRoute(data: EcoSummary) {
  return render(
    <ThemeProvider>
      <EcoRoute summary={data} />
    </ThemeProvider>
  );
}

describe("EcoRoute", () => {
  it("shows every level of the route", () => {
    const { getByText } = renderRoute(summary(6, 0));

    for (const level of ECO_LEVELS) {
      expect(getByText(`eco.levelNames.${level.id}`)).toBeTruthy();
    }
  });

  it("tells how many points are left until the next level", () => {
    const { getByText } = renderRoute(summary(6, 0));

    expect(getByText('eco.nextLevelProgress|{"points":44}')).toBeTruthy();
  });

  it("congratulates on the top level instead of showing a next step", () => {
    const { getByText, queryByText } = renderRoute(summary(900, ECO_LEVELS.length - 1));

    expect(getByText("eco.maxLevelReached")).toBeTruthy();
    expect(queryByText(/eco.nextLevelProgress/)).toBeNull();
  });
});
