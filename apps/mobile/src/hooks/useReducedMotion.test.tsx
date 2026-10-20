import React from "react";
import { AccessibilityInfo, Text } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { useReducedMotion } from "./useReducedMotion";

function Probe() {
  return <Text>{useReducedMotion() ? "reduced" : "full"}</Text>;
}

afterEach(() => jest.restoreAllMocks());

describe("useReducedMotion", () => {
  it("starts with full motion and follows the system answer", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const view = render(<Probe />);
    expect(view.getByText("full")).toBeTruthy();
    await waitFor(() => expect(view.getByText("reduced")).toBeTruthy());
  });

  it("follows later changes of the system setting", async () => {
    let listener: ((value: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((_: string, handler: (value: boolean) => void) => {
      listener = handler;
      return { remove: jest.fn() };
    }) as never);
    const view = render(<Probe />);
    await waitFor(() => expect(listener).toBeDefined());
    const { act } = require("@testing-library/react-native");
    act(() => listener?.(true));
    expect(view.getByText("reduced")).toBeTruthy();
  });
});
