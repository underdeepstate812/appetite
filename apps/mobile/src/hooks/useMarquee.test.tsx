import React from "react";
import { Text } from "react-native";
import { act, render } from "@testing-library/react-native";
import { useMarquee } from "./useMarquee";

function Probe({ width, speed, running, onValue }: { width: number; speed: number; running: boolean; onValue: (read: () => number) => void }) {
  const x = useMarquee(width, speed, running, false);
  onValue(() => (x as unknown as { __getValue: () => number }).__getValue());
  return <Text>probe</Text>;
}

let read: () => number = () => 0;
const mount = (props: { width: number; speed: number; running: boolean }) => render(<Probe {...props} onValue={(r) => (read = r)} />);
const advance = (ms: number) => act(() => void jest.advanceTimersByTime(ms));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useMarquee", () => {
  it("drifts to the left at the given speed", () => {
    mount({ width: 1000, speed: 50, running: true });
    advance(2000);
    expect(read()).toBeLessThan(-90);
    expect(read()).toBeGreaterThan(-110);
  });

  it("stands still while paused and goes on from the same place (not from the start)", () => {
    const view = mount({ width: 1000, speed: 50, running: true });
    advance(2000);
    view.rerender(<Probe width={1000} speed={50} running={false} onValue={(r) => (read = r)} />);
    const paused = read();
    advance(5000);
    expect(read()).toBeCloseTo(paused, 0);
    view.rerender(<Probe width={1000} speed={50} running onValue={(r) => (read = r)} />);
    advance(1000);
    expect(read()).toBeLessThan(paused - 40);
    expect(read()).toBeGreaterThan(paused - 60);
  });

  it("wraps around without a seam: after a full loop it is back near the start, not past the end", () => {
    mount({ width: 500, speed: 50, running: true });
    advance(10_000 + 600);
    expect(read()).toBeLessThanOrEqual(0);
    expect(read()).toBeGreaterThan(-60);
  });

  it("starts over when the content changes (new offers arrived)", () => {
    const view = mount({ width: 1000, speed: 50, running: true });
    advance(4000);
    view.rerender(<Probe width={1200} speed={50} running onValue={(r) => (read = r)} />);
    expect(read()).toBeGreaterThan(-5);
  });

  it("does nothing without content", () => {
    mount({ width: 0, speed: 50, running: true });
    advance(3000);
    expect(read()).toBe(0);
  });
});
