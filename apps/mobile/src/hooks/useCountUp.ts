import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { useReducedMotion } from "./useReducedMotion";

/** Число "набегает" от нуля до значения за duration мс (JS-драйвер: значение — текст, не transform). */
export function useCountUp(target: number, duration = 900): number {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(reduced ? target : 0);

  useEffect(() => {
    if (reduced) {
      setShown(target);
      return;
    }
    const id = value.addListener(({ value: current }) => setShown(current));
    Animated.timing(value, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => setShown(target));
    return () => value.removeListener(id);
  }, [target, duration, reduced, value]);

  return shown;
}
