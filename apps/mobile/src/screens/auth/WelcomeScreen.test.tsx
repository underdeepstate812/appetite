import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import "../../i18n";
import { WelcomeScreen } from "./WelcomeScreen";
import { ThemeProvider } from "../../theme/ThemeProvider";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../../utils/haptics", () => ({ playHaptic: jest.fn() }));

function setup() {
  const navigate = jest.fn();
  const props = { navigation: { navigate }, route: { key: "Welcome", name: "Welcome" } } as unknown;
  const view = render(
    <ThemeProvider>
      <WelcomeScreen {...(props as React.ComponentProps<typeof WelcomeScreen>)} />
    </ThemeProvider>
  );
  return { view, navigate };
}

/** Пульс и арт намеренно скрыты от скринридера, поэтому обычные запросы их не видят. */
const HIDDEN = { includeHiddenElements: true };

afterEach(() => jest.restoreAllMocks());

describe("WelcomeScreen", () => {
  it("is one idea and two actions: a headline with the discount, and sign in / create account", () => {
    const { view } = setup();
    expect(view.getByRole("header", { name: "Вкусная еда рядом — со скидкой до 70%" })).toBeTruthy();
    expect(view.getByText(/Горячие предложения кафе/)).toBeTruthy();
    expect(view.getByRole("button", { name: "Войти" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Создать аккаунт" })).toBeTruthy();
  });

  it("sign in opens the login form, create account opens registration", () => {
    const { view, navigate } = setup();
    fireEvent.press(view.getByRole("button", { name: "Войти" }));
    expect(navigate).toHaveBeenLastCalledWith("Login");
    fireEvent.press(view.getByRole("button", { name: "Создать аккаунт" }));
    expect(navigate).toHaveBeenLastCalledWith("Register");
  });

  it("both buttons pulse, one after another — and the pulse is invisible to assistive tech", () => {
    const { view } = setup();
    const rings = view.getAllByTestId("button-pulse", HIDDEN);
    expect(rings).toHaveLength(2);
    for (const ring of rings) {
      expect(ring.props.accessibilityElementsHidden).toBe(true);
      expect(ring.props.importantForAccessibility).toBe("no-hide-descendants");
    }
    // Названия кнопок от пульсации не меняются.
    expect(view.getAllByRole("button").map((button) => button.props.accessibilityLabel)).toEqual(["Войти", "Создать аккаунт"]);
  });

  it("with reduce-motion enabled the buttons are still and the discount art stays put", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const { view } = setup();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(view.queryAllByTestId("button-pulse", HIDDEN)).toHaveLength(0);
    expect(view.getByText("−70%", HIDDEN)).toBeTruthy();
  });

  it("keeps the decorative map out of the accessibility tree (the headline carries the meaning)", () => {
    const { view } = setup();
    expect(view.queryByText("−70%")).toBeNull();
    expect(view.getByText("−70%", HIDDEN)).toBeTruthy();
  });
});
