import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OffersRibbon } from "./OffersRibbon";

beforeEach(() => {
  // jsdom не реализует эти API; лента использует их для reveal и автоскролла.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  }));
});

/** Настоящий клик пользователя — это pointerdown → pointerup → click; не один голый click. */
function tap(element: HTMLElement) {
  fireEvent.pointerDown(element);
  fireEvent.pointerUp(element);
  fireEvent.click(element);
}

describe("OffersRibbon tiles", () => {
  it("have no like / favourite button (it was removed from the cards)", () => {
    const { container } = render(<OffersRibbon />);
    expect(screen.queryAllByRole("button", { name: /избранн/i })).toHaveLength(0);
    expect(container.querySelector(".offer-tile-like")).toBeNull();
    expect(container.querySelector(".offer-tile svg.lucide-heart")).toBeNull();
  });

  it("does not start a drag (no pointer capture) on a plain tap", () => {
    const { container } = render(<OffersRibbon />);
    const setPointerCapture = vi.fn();
    HTMLElement.prototype.setPointerCapture = setPointerCapture;

    tap(container.querySelector(".offer-tile") as HTMLElement);

    expect(setPointerCapture).not.toHaveBeenCalled();
  });

  it("captures the pointer only after the pointer actually moves (a drag)", () => {
    const { container } = render(<OffersRibbon />);
    const setPointerCapture = vi.fn();
    HTMLElement.prototype.setPointerCapture = setPointerCapture;
    HTMLElement.prototype.releasePointerCapture = vi.fn();
    const strip = container.querySelector(".ribbon-scroll") as HTMLElement;

    fireEvent.pointerDown(strip, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(strip, { clientX: 298, pointerId: 1 });
    expect(setPointerCapture).not.toHaveBeenCalled();

    fireEvent.pointerMove(strip, { clientX: 250, pointerId: 1 });
    expect(setPointerCapture).toHaveBeenCalledWith(1);
  });
});

describe("OffersRibbon pause control", () => {
  it("is not shown to the eye, but stays a real, keyboard-operable button for keyboard and screen-reader users (WCAG 2.2.2)", () => {
    render(<OffersRibbon />);
    // в тестах prefers-reduced-motion включён → лента стартует остановленной
    const play = screen.getByRole("button", { name: "Запустить движение ленты" });
    expect(play).toHaveAttribute("aria-pressed", "true");
    expect(play).toHaveClass("ribbon-play"); // визуально скрывается стилем .ribbon-play:not(:focus-visible)
    fireEvent.click(play);
    expect(screen.getByRole("button", { name: "Остановить движение ленты" })).toHaveAttribute("aria-pressed", "false");
  });
});
