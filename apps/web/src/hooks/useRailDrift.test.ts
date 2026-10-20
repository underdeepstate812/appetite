import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { DRIFT_PX_PER_S, USER_IDLE_MS, useRailDrift } from "./useRailDrift";

const LOOP_WIDTH = 1000;

let now = 0;
let queue: Array<(t: number) => void> = [];
let scrollLeft = 0;
let ioCallback: ((entries: Array<{ intersectionRatio: number }>) => void) | null = null;

/** Лента без вёрстки: оригинал на 0, копия на LOOP_WIDTH; scrollLeft — обычное число; кадры гоняем руками. */
function makeRail() {
  const rail = document.createElement("ul");
  const first = document.createElement("li");
  first.className = "showcase-item";
  const clone = document.createElement("li");
  clone.className = "showcase-item is-clone";
  Object.defineProperty(first, "offsetLeft", { value: 0 });
  Object.defineProperty(clone, "offsetLeft", { value: LOOP_WIDTH });
  Object.defineProperty(rail, "scrollLeft", { get: () => scrollLeft, set: (value: number) => (scrollLeft = value), configurable: true });
  rail.append(first, clone);
  return rail;
}

/** Прокручиваем время на ms миллисекунд кадрами по 16 мс. */
function run(ms: number) {
  act(() => {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) {
      now += 16;
      const callbacks = queue;
      queue = [];
      callbacks.forEach((cb) => cb(now));
    }
  });
}

function setup(options: { playing?: boolean; loops?: boolean } = {}) {
  const rail = makeRail();
  const wrap = document.createElement("div");
  const hook = renderHook((props: { playing: boolean; loops: boolean }) => useRailDrift({ current: rail }, { current: wrap }, { ...props, itemsKey: "k" }), {
    initialProps: { playing: options.playing ?? true, loops: options.loops ?? true },
  });
  run(32); // первый кадр: хук запоминает время
  const mouse = (type: "mouse" | "touch") => ({ pointerType: type }) as unknown as ReactPointerEvent;
  return { rail, hook, mouse, bind: () => hook.result.current };
}

beforeEach(() => {
  now = 1000;
  queue = [];
  scrollLeft = 0;
  ioCallback = null;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => queue.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {
    queue = [];
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (entries: Array<{ intersectionRatio: number }>) => void) {
        ioCallback = cb;
      }
      observe() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useRailDrift", () => {
  it("drifts at the reading pace (~34 px/s), independent of frame rate", () => {
    setup();
    const start = scrollLeft;
    run(1000);
    expect(scrollLeft - start).toBeGreaterThan(DRIFT_PX_PER_S * 0.9);
    expect(scrollLeft - start).toBeLessThan(DRIFT_PX_PER_S * 1.1);
  });

  it("stands still when paused or when there is no loop copy", () => {
    setup({ playing: false });
    run(1000);
    expect(scrollLeft).toBe(0);
    scrollLeft = 0;
    setup({ loops: false });
    run(1000);
    expect(scrollLeft).toBe(0);
  });

  it("a mouse over the rail stops it; leaving lets it go on — but a touch pointer never freezes it", () => {
    const { bind, mouse } = setup();
    act(() => bind().onPointerEnter(mouse("mouse")));
    const held = scrollLeft;
    run(1000);
    expect(scrollLeft).toBe(held);
    act(() => bind().onPointerLeave(mouse("mouse")));
    run(1000);
    expect(scrollLeft).toBeGreaterThan(held + 20);
    const before = scrollLeft;
    act(() => bind().onPointerEnter(mouse("touch"))); // у касания нет парного pointerleave — иначе лента встала бы навсегда
    run(1000);
    expect(scrollLeft).toBeGreaterThan(before + 20);
  });

  it("keyboard focus inside the rail stops it until focus leaves", () => {
    const { bind } = setup();
    act(() => bind().onFocus({} as never));
    const held = scrollLeft;
    run(1000);
    expect(scrollLeft).toBe(held);
    act(() => bind().onBlur({} as never));
    run(1000);
    expect(scrollLeft).toBeGreaterThan(held + 20);
  });

  it("after the user's own scrolling (finger / wheel) it waits a moment and then carries on from where they left it", () => {
    const { bind, rail } = setup();
    act(() => bind().onTouchStart({} as never));
    rail.scrollLeft = 400; // человек пролистал сам
    run(USER_IDLE_MS - 200);
    expect(scrollLeft).toBe(400);
    run(1200);
    expect(scrollLeft).toBeGreaterThan(400 + 10);
    const mid = scrollLeft;
    act(() => bind().onWheel({} as never));
    run(1000);
    expect(scrollLeft).toBe(mid);
  });

  it("is seamless: reaching the copy jumps back by exactly one loop", () => {
    const { rail } = setup();
    rail.scrollLeft = LOOP_WIDTH - 5;
    run(400);
    expect(scrollLeft).toBeLessThan(LOOP_WIDTH * 0.1);
    expect(scrollLeft).toBeGreaterThanOrEqual(0);
  });

  it("also normalises a hand-scroll into the copy, even while paused", () => {
    const { rail } = setup({ playing: false });
    rail.scrollLeft = LOOP_WIDTH + 120;
    run(100);
    expect(scrollLeft).toBe(120);
  });

  it("does not run while the rail is off screen (ratio < 15%), and resumes when it is back", () => {
    setup();
    act(() => ioCallback?.([{ intersectionRatio: 0 }]));
    const held = scrollLeft;
    run(1000);
    expect(scrollLeft).toBe(held);
    act(() => ioCallback?.([{ intersectionRatio: 0.6 }]));
    run(1000);
    expect(scrollLeft).toBeGreaterThan(held + 20);
  });

  it("toggling play/pause takes effect at once", () => {
    const { hook } = setup();
    run(500);
    hook.rerender({ playing: false, loops: true });
    const held = scrollLeft;
    run(1000);
    expect(scrollLeft).toBe(held);
    hook.rerender({ playing: true, loops: true });
    run(1000);
    expect(scrollLeft).toBeGreaterThan(held + 20);
  });

  it("cleans up its animation frame on unmount", () => {
    const { hook } = setup();
    hook.unmount();
    expect(queue).toHaveLength(0);
  });
});
