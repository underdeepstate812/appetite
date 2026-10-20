import React, { createRef } from "react";
import { Text, TextInput } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { TextField } from "./TextField";
import { ThemeProvider } from "../theme/ThemeProvider";

const renderField = (props: Partial<React.ComponentProps<typeof TextField>> = {}) =>
  render(
    <ThemeProvider>
      <TextField label="Email" value="" onChangeText={() => {}} {...props} />
    </ThemeProvider>
  );

describe("TextField", () => {
  it("names the input by its label so screen readers and tests can find it", () => {
    const view = renderField();
    expect(view.getByLabelText("Email")).toBeTruthy();
  });

  it("shows an error with alert semantics and no hint at the same time", () => {
    const view = renderField({ error: "Введите email", hint: "Подсказка" });
    expect(view.getByRole("alert").props.children).toBe("Введите email");
    expect(view.queryByText("Подсказка")).toBeNull();
  });

  it("shows the hint when there is no error", () => {
    const view = renderField({ hint: "Подсказка" });
    expect(view.getByText("Подсказка")).toBeTruthy();
    expect(view.queryByRole("alert")).toBeNull();
  });

  it("renders a right accessory inside the field and reserves room so text never runs under it", () => {
    const view = renderField({ rightAccessory: <Text>eye</Text> });
    expect(view.getByText("eye")).toBeTruthy();
    expect(view.getByLabelText("Email").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ paddingRight: 52 })]));
  });

  it("forwards the ref so forms can move focus to the next field", () => {
    const ref = createRef<TextInput>();
    render(
      <ThemeProvider>
        <TextField ref={ref} label="Email" value="" onChangeText={() => {}} />
      </ThemeProvider>
    );
    expect(ref.current).toBeTruthy();
    expect(typeof ref.current?.focus).toBe("function");
  });

  it("passes through autofill and keyboard props and still calls the caller's focus/blur handlers", () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const view = renderField({ autoComplete: "username", returnKeyType: "next", onFocus, onBlur });
    const input = view.getByLabelText("Email");
    expect(input.props.autoComplete).toBe("username");
    expect(input.props.returnKeyType).toBe("next");
    fireEvent(input, "focus");
    fireEvent(input, "blur");
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("marks the input invalid for assistive tech only when there is an error", () => {
    expect(renderField({ error: "x" }).getByLabelText("Email").props["aria-invalid"]).toBe(true);
    expect(renderField().getByLabelText("Email").props["aria-invalid"]).toBeUndefined();
  });
});
