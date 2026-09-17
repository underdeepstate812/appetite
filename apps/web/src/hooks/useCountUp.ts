import { useEffect, useRef, useState } from "react";

const EASE_OUT_EXPO = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Анимированный счётчик 0 → target, запускается один раз при active=true (обычно —
 * когда карточка со статистикой попадает во вьюпорт через useReveal). requestAnimationFrame
 * вместо setInterval — плавнее и не блокирует поток при уходе со страницы.
 */
export function useCountUp(target: number, active: boolean, durationMs = 1200) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      setValue(Math.round(target * EASE_OUT_EXPO(progress)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [active, target, durationMs]);

  return value;
}
