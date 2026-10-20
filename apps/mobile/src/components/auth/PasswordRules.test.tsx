import React from "react";
import { render } from "@testing-library/react-native";
import "../../i18n";
import { PasswordRules } from "./PasswordRules";
import { ThemeProvider } from "../../theme/ThemeProvider";

const summary = (password: string) =>
  render(
    <ThemeProvider>
      <PasswordRules password={password} />
    </ThemeProvider>
  ).getByLabelText(/Требования к паролю/).props.accessibilityLabel as string;

describe("PasswordRules", () => {
  it("lists all five requirements", () => {
    const view = render(
      <ThemeProvider>
        <PasswordRules password="" />
      </ThemeProvider>
    );
    for (const label of ["8+ символов", "Заглавную", "Строчную", "Цифру", "Спецсимвол"]) expect(view.getByText(label)).toBeTruthy();
  });

  it("announces progress as one sentence for screen readers (status is not colour-only)", () => {
    expect(summary("")).toBe("Требования к паролю: выполнено 0 из 5");
    expect(summary("abc")).toBe("Требования к паролю: выполнено 1 из 5");
    expect(summary("Abcdefg1")).toBe("Требования к паролю: выполнено 4 из 5");
    expect(summary("Abcdefg1!")).toBe("Требования к паролю: выполнено 5 из 5");
  });
});
