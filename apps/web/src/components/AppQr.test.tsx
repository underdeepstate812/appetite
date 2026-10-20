import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppQr } from "./AppQr";

const pathOf = (value: string) => {
  const { container, unmount } = render(<AppQr value={value} label="qr" />);
  const d = container.querySelector("path")?.getAttribute("d") ?? "";
  unmount();
  return d;
};

describe("AppQr", () => {
  it("renders a labelled vector QR with dark modules", () => {
    const { getByRole } = render(<AppQr value="https://appetite.example/map" label="QR для телефона" />);
    const svg = getByRole("img", { name: "QR для телефона" });
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(pathOf("https://appetite.example/map").length).toBeGreaterThan(200);
  });

  it("encodes the value: different links give different codes, the same link the same", () => {
    expect(pathOf("https://a.example/map")).not.toBe(pathOf("https://b.example/map"));
    expect(pathOf("https://a.example/map")).toBe(pathOf("https://a.example/map"));
  });
});
