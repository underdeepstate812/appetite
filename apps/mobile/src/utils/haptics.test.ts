import * as Haptics from "expo-haptics";
import { HAPTIC_SCORES, playHaptic } from "./haptics";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Soft: "soft", Light: "light", Medium: "medium", Heavy: "heavy", Rigid: "rigid" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

describe("playHaptic", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("locks the payment when the ring closes (360ms) and settles with a soft pulse", () => {
    playHaptic("confirm");
    expect(Haptics.impactAsync).not.toHaveBeenCalled();

    jest.advanceTimersByTime(359);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith("rigid");

    jest.advanceTimersByTime(90);
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith("soft");
  });

  it("accepts the order with an immediate success, then three light ticks for the PIN keys and a soft settle", () => {
    playHaptic("accepted");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");

    jest.advanceTimersByTime(1100);
    const impacts = (Haptics.impactAsync as jest.Mock).mock.calls.map(([style]) => style);
    expect(impacts).toEqual(["light", "light", "light", "soft"]);
  });

  it("keeps at least 80ms between the impulses of a score", () => {
    for (const kind of ["confirm", "accepted"] as const) {
      const times = HAPTIC_SCORES[kind].map((step) => step.at);
      for (let i = 1; i < times.length; i += 1) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(80);
    }
  });

  it("can be cancelled before the later pulses land", () => {
    const cancel = playHaptic("confirm");
    cancel();
    jest.advanceTimersByTime(1000);

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("lets a new long score replace one that is still playing", () => {
    playHaptic("confirm");
    playHaptic("accepted");
    jest.advanceTimersByTime(1200);

    // Осталась только партитура "accepted": success + 3 light + soft, а rigid от "confirm" вытеснен.
    expect((Haptics.impactAsync as jest.Mock).mock.calls.map(([style]) => style)).not.toContain("rigid");
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it("uses the selection generator for selection ticks and single pulses for reduced motion", () => {
    playHaptic("select");
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);

    playHaptic("thud");
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith("medium");

    playHaptic("success");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
  });
});
