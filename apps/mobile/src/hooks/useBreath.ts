import { useEffect } from "react";
import { Animated, Easing } from "react-native";

// Одно общее "дыхание" на весь список: сколько бы горящих карточек ни было на экране,
// крутится ровно одна анимация (native driver), а искры лишь подписаны на её значение.
const breath = new Animated.Value(0);
let subscribers = 0;
let loop: Animated.CompositeAnimation | null = null;

/** Общее значение 0..1..0 (период 1600 мс). Пока `active` ложно — цикл не запускается и не держится. */
export function useBreath(active: boolean): Animated.Value {
  useEffect(() => {
    if (!active) return;
    subscribers += 1;
    if (subscribers === 1) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breath, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(breath, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      loop.start();
    }
    return () => {
      subscribers -= 1;
      if (subscribers === 0) {
        loop?.stop();
        loop = null;
      }
    };
  }, [active]);

  return breath;
}
