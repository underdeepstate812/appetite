import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, type LayoutChangeEvent } from "react-native";
import { useReducedMotion } from "./useReducedMotion";

/** Кривая и длительность «жидкой» плашки из LiquidRadio (21st.dev): резкий старт и мягкая посадка. */
export const LIQUID_EASING = Easing.bezier(0.16, 1, 0.3, 1);
export const SLIDE_MS = 340;

/**
 * Одна плашка выбора, которая плавно переезжает между вариантами (вместо того чтобы каждый вариант по отдельности перекрашивался).
 * Каждый вариант сообщает свою геометрию через `onItemLayout(key)`; плашка занимает место выбранного.
 * Первое размещение и пересчёт после смены раскладки (перенос текста, загрузка шрифта) — без анимации, переключение — с ней.
 * Движение положения и размера идёт не на native driver (top/height/left/width им не анимируются): вариантов мало, это дёшево.
 */
export function useSlidingHighlight(selected: string, axis: "x" | "y") {
  const reduced = useReducedMotion();
  const spots = useRef(new Map<string, { pos: number; size: number }>());
  const pos = useRef(new Animated.Value(0)).current;
  const size = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);
  const placed = useRef(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const goTo = useCallback(
    (key: string, animate: boolean) => {
      const spot = spots.current.get(key);
      if (!spot) return;
      if (!animate || reduced || !placed.current) {
        pos.setValue(spot.pos);
        size.setValue(spot.size);
        placed.current = true;
        setReady(true);
        return;
      }
      Animated.parallel([
        Animated.timing(pos, { toValue: spot.pos, duration: SLIDE_MS, easing: LIQUID_EASING, useNativeDriver: false }),
        Animated.timing(size, { toValue: spot.size, duration: SLIDE_MS, easing: LIQUID_EASING, useNativeDriver: false }),
      ]).start();
    },
    [pos, size, reduced]
  );

  useEffect(() => {
    goTo(selected, true);
  }, [selected, goTo]);

  const onItemLayout = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      const { x, y, width, height } = event.nativeEvent.layout;
      spots.current.set(key, axis === "x" ? { pos: x, size: width } : { pos: y, size: height });
      // Раскладка выбранного изменилась (или это первый замер) — встаём на место сразу, без «поездки».
      if (key === selectedRef.current) goTo(key, false);
    },
    [axis, goTo]
  );

  return { pos, size, ready, onItemLayout };
}
