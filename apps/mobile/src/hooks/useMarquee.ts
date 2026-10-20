import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { ribbonDurationMs } from "../utils/ribbon";

/**
 * Бесконечный «проезд» по оси X на native driver: значение идёт от 0 до −setWidth и мгновенно возвращается в 0 — если
 * контент состоит из повторяющихся наборов шириной setWidth, шва не видно. running=false ставит ленту на паузу ровно там,
 * где она стоит, и продолжает оттуда же (а не с начала). Смена setWidth (пришли новые данные) — начать с нуля.
 * native=false — только для тестов: JS-драйвер, чтобы значение можно было прочитать (на native driver оно живёт вне JS).
 */
export function useMarquee(setWidth: number, speed: number, running: boolean, native = true): Animated.Value {
  const x = useRef(new Animated.Value(0)).current;
  const position = useRef(0);
  const lastWidth = useRef(setWidth);

  useEffect(() => {
    if (lastWidth.current !== setWidth) {
      lastWidth.current = setWidth;
      position.current = 0;
      x.setValue(0);
    }
    if (!running || setWidth <= 0) return;
    let cancelled = false;
    const run = () => {
      const remaining = setWidth + position.current; // position ≤ 0
      Animated.timing(x, { toValue: -setWidth, duration: ribbonDurationMs(remaining, speed), easing: Easing.linear, useNativeDriver: native }).start(({ finished }) => {
        if (!finished || cancelled) return;
        position.current = 0;
        x.setValue(0);
        run();
      });
    };
    x.setValue(position.current);
    run();
    return () => {
      cancelled = true;
      x.stopAnimation((value) => {
        position.current = value;
      });
    };
  }, [running, setWidth, speed, x, native]);

  return x;
}
