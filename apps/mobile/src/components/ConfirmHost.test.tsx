import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConfirmHost } from "./ConfirmHost";
import { ThemeProvider } from "../theme/ThemeProvider";
import { confirmAction } from "../utils/confirm";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Soft: "soft", Light: "light", Medium: "medium", Heavy: "heavy", Rigid: "rigid" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

function mountHost() {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <ConfirmHost />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe("ConfirmHost", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("shows the request in the sheet and resolves true when the destructive action is pressed", async () => {
    const view = mountHost();

    let answer: boolean | undefined;
    act(() => {
      void confirmAction("Отменить заказ?", "Место снова станет доступно", "Да, отменить", "Нет").then((value) => {
        answer = value;
      });
    });

    expect(view.getByText("Отменить заказ?")).toBeTruthy();
    expect(view.getByText("Место снова станет доступно")).toBeTruthy();

    fireEvent.press(view.getByText("Да, отменить"));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(answer).toBe(true);
  });

  it("resolves false when the safe action is pressed", async () => {
    const view = mountHost();

    let answer: boolean | undefined;
    act(() => {
      void confirmAction("Отменить заказ?", "…", "Да, отменить", "Нет").then((value) => {
        answer = value;
      });
    });

    fireEvent.press(view.getByText("Нет"));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(answer).toBe(false);
  });
});
