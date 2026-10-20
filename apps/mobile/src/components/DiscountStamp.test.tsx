import React from "react";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { DiscountStamp } from "./DiscountStamp";
import { ThemeProvider } from "../theme/ThemeProvider";

function stampBackground(ratio: number) {
  const view = render(
    <ThemeProvider>
      <DiscountStamp percent={45} ratio={ratio} />
    </ThemeProvider>
  );
  const label = view.getByText("−45%");
  let node = label.parent;
  while (node) {
    const background = StyleSheet.flatten(node.props.style)?.backgroundColor;
    if (background) return background;
    node = node.parent;
  }
  return undefined;
}

describe("DiscountStamp", () => {
  it("shows the discount with a real minus sign", () => {
    const view = render(
      <ThemeProvider>
        <DiscountStamp percent={60} />
      </ThemeProvider>
    );
    expect(view.getByText("−60%")).toBeTruthy();
  });

  it("follows the heat of the offer: brand colour when calm, amber → orange → red as time runs out", () => {
    const calm = stampBackground(0.1);
    expect(stampBackground(0.4)).toBe("#fbbf24");
    expect(stampBackground(0.6)).toBe("#ff8a3d");
    expect(stampBackground(0.9)).toBe("#ff5c4d");
    expect(calm).not.toBe("#fbbf24");
  });
});
