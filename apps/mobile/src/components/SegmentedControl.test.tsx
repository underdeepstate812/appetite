import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SegmentedControl } from "./SegmentedControl";
import { ThemeProvider } from "../theme/ThemeProvider";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

const OPTIONS: { value: "email" | "phone"; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Телефон" },
];

function renderControl(value: "email" | "phone", onChange: (value: "email" | "phone") => void) {
  return render(
    <ThemeProvider>
      <SegmentedControl options={OPTIONS} value={value} onChange={onChange} />
    </ThemeProvider>
  );
}

describe("SegmentedControl", () => {
  it("renders every option's label", () => {
    const { getByText } = renderControl("email", jest.fn());

    expect(getByText("Email")).toBeTruthy();
    expect(getByText("Телефон")).toBeTruthy();
  });

  it("calls onChange with the pressed option's value", () => {
    const onChange = jest.fn();
    const { getByText } = renderControl("email", onChange);

    fireEvent.press(getByText("Телефон"));

    expect(onChange).toHaveBeenCalledWith("phone");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not call onChange for an option that is not pressed", () => {
    const onChange = jest.fn();
    const { getByText } = renderControl("email", onChange);

    fireEvent.press(getByText("Телефон"));

    expect(onChange).not.toHaveBeenCalledWith("email");
  });
});
