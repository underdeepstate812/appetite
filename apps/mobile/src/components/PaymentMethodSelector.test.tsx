import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { PaymentMethodSelector, type PaymentMethod } from "./PaymentMethodSelector";
import { ThemeProvider } from "../theme/ThemeProvider";

function mount(value: PaymentMethod = "card") {
  const onChange = jest.fn();
  const view = render(
    <ThemeProvider>
      <PaymentMethodSelector
        value={value}
        onChange={onChange}
        cardLabel="Банковская карта"
        cardHint="Visa, Mastercard, МИР"
        sbpLabel="СБП"
        sbpHint="Оплата по QR через банк"
        groupLabel="Способ оплаты"
      />
    </ThemeProvider>
  );
  return { view, onChange };
}

describe("PaymentMethodSelector", () => {
  it("is a named radio group, so a screen reader knows what is being chosen", () => {
    const { view } = mount();
    // Контейнер группы не «элемент доступности» (иначе он проглотил бы радио-кнопки), поэтому ищем по подписи, а не по роли.
    expect(view.getByLabelText("Способ оплаты").props.accessibilityRole).toBe("radiogroup");
    expect(view.getAllByRole("radio")).toHaveLength(2);
  });

  it("says which method is selected, and reads the hint together with the name", () => {
    const { view } = mount("sbp");
    expect(view.getByRole("radio", { name: "СБП. Оплата по QR через банк" }).props.accessibilityState).toMatchObject({ checked: true });
    expect(view.getByRole("radio", { name: "Банковская карта. Visa, Mastercard, МИР" }).props.accessibilityState).toMatchObject({ checked: false });
  });

  it("reports the choice", () => {
    const { view, onChange } = mount("card");
    fireEvent.press(view.getByRole("radio", { name: /СБП/ }));
    expect(onChange).toHaveBeenCalledWith("sbp");
  });
});
