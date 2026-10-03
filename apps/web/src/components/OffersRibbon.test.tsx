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

describe("OffersRibbon like button", () => {
  it("toggles the saved state after a real tap (pointerdown/up + click)", () => {
    render(<OffersRibbon />);

    const like = screen.getAllByRole("button", { name: "Сохранить в избранное" })[0];
    expect(like).toHaveAttribute("aria-pressed", "false");

    tap(like);

    const pressed = screen.getAllByRole("button", { name: "Убрать из избранного" })[0];
    expect(pressed).toHaveAttribute("aria-pressed", "true");
  });

  it("does not start a drag (no pointer capture) on a plain tap, so the click reaches the button", () => {
    render(<OffersRibbon />);
    const setPointerCapture = vi.fn();
    HTMLElement.prototype.setPointerCapture = setPointerCapture;

    tap(screen.getAllByRole("button", { name: "Сохранить в избранное" })[0]);

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
