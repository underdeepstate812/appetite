import React from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Button } from "./Button";
import { ThemeProvider } from "../theme/ThemeProvider";
import { signatureRadius } from "../theme/tokens";
import { playHaptic } from "../utils/haptics";

jest.mock("../utils/haptics", () => ({ playHaptic: jest.fn() }));

const renderButton = (props: Partial<React.ComponentProps<typeof Button>> = {}) => {
  const onPress = jest.fn();
  const view = render(
    <ThemeProvider>
      <Button title="Войти" onPress={onPress} {...props} />
    </ThemeProvider>
  );
  return { view, onPress, button: view.getByRole("button", { name: "Войти" }) };
};
const style = (node: ReturnType<ReturnType<typeof render>["getByRole"]>) => StyleSheet.flatten(node.props.style);

beforeEach(() => jest.clearAllMocks());

describe("Button (same look as the website)", () => {
  it("has the signature outline: two sharp and two rounded corners on the diagonal", () => {
    const { button } = renderButton();
    expect(style(button)).toMatchObject(signatureRadius);
    expect(signatureRadius).toEqual({ borderTopLeftRadius: 4, borderTopRightRadius: 18, borderBottomRightRadius: 4, borderBottomLeftRadius: 18 });
  });

  it("is a flat brand-colour fill with a coloured shadow (primary)", () => {
    const { button } = renderButton();
    expect(style(button).backgroundColor).toBe("#0F766E");
    expect(String(style(button).boxShadow)).toContain("#0F766E");
  });

  it("is touch friendly: at least 48 px tall and exposes its title to assistive tech", () => {
    const { button } = renderButton();
    expect(style(button).minHeight).toBeGreaterThanOrEqual(48);
    expect(button.props.accessibilityLabel).toBe("Войти");
  });

  it("presses with a light haptic, once", () => {
    const { button, onPress } = renderButton();
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(playHaptic).toHaveBeenCalledWith("tap");
  });

  it("stays silent when haptic is turned off", () => {
    const { button } = renderButton({ haptic: "none" });
    fireEvent.press(button);
    expect(playHaptic).not.toHaveBeenCalled();
  });

  it("ignores presses while loading or disabled and reports the state to assistive tech", () => {
    const loading = renderButton({ loading: true });
    fireEvent.press(loading.button);
    expect(loading.onPress).not.toHaveBeenCalled();
    expect(loading.button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    const disabled = renderButton({ disabled: true });
    fireEvent.press(disabled.button);
    expect(disabled.onPress).not.toHaveBeenCalled();
    expect(style(disabled.button).opacity).toBe(0.45);
  });

  it("secondary is a white surface with a 1.5px border (like .btn-secondary), without a brand fill", () => {
    const { button } = renderButton({ variant: "secondary" });
    expect(style(button)).toMatchObject({ backgroundColor: "#FFFFFF", borderWidth: 1.5 });
  });

  it("ghost has no background", () => {
    expect(style(renderButton({ variant: "ghost" }).button).backgroundColor).toBe("transparent");
  });

  it("danger is a solid red fill; dangerSoft is a tint", () => {
    expect(style(renderButton({ variant: "danger" }).button).backgroundColor).toBe("#B42318");
    expect(style(renderButton({ variant: "dangerSoft" }).button).backgroundColor).toBe("#FBE3DE");
  });

  it("shows the arrow companion only when asked and not while loading", () => {
    const { view } = renderButton({ arrow: true });
    expect(view.UNSAFE_queryAllByProps({ strokeWidth: 2.4 }).length).toBeGreaterThan(0);
    const plain = renderButton();
    expect(plain.view.UNSAFE_queryAllByProps({ strokeWidth: 2.4 }).length).toBe(0);
    const busy = renderButton({ arrow: true, loading: true });
    expect(busy.view.UNSAFE_queryAllByProps({ strokeWidth: 2.4 }).length).toBe(0);
  });
});

describe("Button pulse", () => {
  it("draws no ring unless asked to", () => {
    const { view } = renderButton();
    expect(view.queryByTestId("button-pulse", { includeHiddenElements: true })).toBeNull();
  });

  it("draws a ring that assistive tech never sees and that does not change the button's name", () => {
    const { view, button } = renderButton({ pulse: true });
    const ring = view.getByTestId("button-pulse", { includeHiddenElements: true });
    expect(ring.props.pointerEvents).toBe("none");
    expect(ring.props.accessibilityElementsHidden).toBe(true);
    expect(button.props.accessibilityLabel).toBe("Войти");
  });

  it("the ring follows the signature outline and takes the given colour", () => {
    const { view } = renderButton({ pulse: { color: "#5eead4", spread: 12 } });
    const ring = StyleSheet.flatten(view.getByTestId("button-pulse", { includeHiddenElements: true }).props.style);
    expect(ring).toMatchObject({ ...signatureRadius, borderColor: "#5eead4" });
  });

  it("rests while disabled or loading", () => {
    expect(renderButton({ pulse: true, disabled: true }).view.queryByTestId("button-pulse", { includeHiddenElements: true })).toBeNull();
    expect(renderButton({ pulse: true, loading: true }).view.queryByTestId("button-pulse", { includeHiddenElements: true })).toBeNull();
  });

  it("is switched off when the system asks to reduce motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const { view } = renderButton({ pulse: true });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(view.queryByTestId("button-pulse", { includeHiddenElements: true })).toBeNull();
    jest.restoreAllMocks();
  });
});
