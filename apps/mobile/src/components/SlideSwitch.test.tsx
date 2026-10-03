import React from "react";
import { Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { SlideSwitch, type SlideSwitchOption } from "./SlideSwitch";
import { ThemeProvider } from "../theme/ThemeProvider";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

type Mode = "system" | "light" | "dark";

const OPTIONS: SlideSwitchOption<Mode>[] = (["system", "light", "dark"] as const).map((value) => ({
  value,
  accessibilityLabel: `mode-${value}`,
  render: () => <Text>{value}</Text>,
}));

function renderSwitch(value: Mode, onChange: (value: Mode) => void) {
  return render(
    <ThemeProvider>
      <SlideSwitch options={OPTIONS} value={value} onChange={onChange} />
    </ThemeProvider>
  );
}

describe("SlideSwitch", () => {
  it("marks only the selected option as checked", () => {
    const { getByLabelText } = renderSwitch("light", jest.fn());

    expect(getByLabelText("mode-light").props.accessibilityState).toMatchObject({ checked: true });
    expect(getByLabelText("mode-system").props.accessibilityState).toMatchObject({ checked: false });
    expect(getByLabelText("mode-dark").props.accessibilityState).toMatchObject({ checked: false });
  });

  it("calls onChange with the pressed option's value", () => {
    const onChange = jest.fn();
    const { getByLabelText } = renderSwitch("system", onChange);

    fireEvent.press(getByLabelText("mode-dark"));

    expect(onChange).toHaveBeenCalledWith("dark");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
