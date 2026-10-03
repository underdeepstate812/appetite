import React from "react";
import { Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { ErrorBoundary } from "./ErrorBoundary";
import { ThemeProvider } from "../theme/ThemeProvider";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Soft: "soft", Light: "light", Medium: "medium", Heavy: "heavy", Rigid: "rigid" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error("boom");
  return <Text>recovered</Text>;
}

function mount() {
  return render(
    <ThemeProvider>
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    shouldThrow = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("shows a friendly fallback instead of a blank screen when a child throws", () => {
    const view = mount();

    expect(view.getByText("common.error")).toBeTruthy();
    expect(view.getByText("common.errorBoundaryHint")).toBeTruthy();
    expect(view.queryByText("recovered")).toBeNull();
  });

  it("re-mounts the subtree when the user presses retry", () => {
    const view = mount();
    shouldThrow = false;

    fireEvent.press(view.getByText("common.retry"));

    expect(view.getByText("recovered")).toBeTruthy();
  });

  it("renders children untouched when nothing fails", () => {
    shouldThrow = false;
    expect(mount().getByText("recovered")).toBeTruthy();
  });
});
