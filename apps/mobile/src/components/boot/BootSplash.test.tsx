import React from "react";
import { AccessibilityInfo } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { act, fireEvent, render } from "@testing-library/react-native";
import "../../i18n";
import { BootSplash } from "./BootSplash";
import { SPLASH_MIN_MS } from "../../utils/boot";

const flush = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("BootSplash", () => {
  it("is announced as loading, with the brand name", () => {
    const view = render(<BootSplash ready={false} />);
    const bar = view.getByRole("progressbar");
    expect(bar.props.accessibilityLabel).toBe("Appetite — Загрузка...");
    expect(view.getByText("Appetite")).toBeTruthy();
  });

  it("hands over from the native splash once its own first frame is drawn", () => {
    const view = render(<BootSplash ready={false} />);
    fireEvent(view.getByRole("progressbar"), "layout");
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it("stays on screen while the app is not ready, however long that takes", async () => {
    const onDone = jest.fn();
    const view = render(<BootSplash ready={false} onDone={onDone} />);
    await flush(6000);
    expect(view.queryByRole("progressbar")).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("never flashes: even when ready at once it is held for the minimum time, then leaves exactly once", async () => {
    const onDone = jest.fn();
    const view = render(<BootSplash ready onDone={onDone} />);
    await flush(SPLASH_MIN_MS - 150);
    expect(onDone).not.toHaveBeenCalled();
    expect(view.queryByRole("progressbar")).toBeTruthy();
    await flush(1000);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(view.queryByRole("progressbar")).toBeNull();
  });

  it("stops intercepting touches as soon as the app is ready (the exit fade must not block the first tap)", () => {
    const loading = render(<BootSplash ready={false} />);
    expect(loading.getByRole("progressbar").props.pointerEvents).toBe("auto");
    const ready = render(<BootSplash ready />);
    expect(ready.getAllByRole("progressbar")[0].props.pointerEvents).toBe("none");
  });

  it("with reduce-motion enabled it is only a short flash of the mark", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const onDone = jest.fn();
    render(<BootSplash ready onDone={onDone} />);
    await act(async () => {}); // система отвечает про reduce-motion асинхронно — дожидаемся ответа, потом идёт время
    await flush(700);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
