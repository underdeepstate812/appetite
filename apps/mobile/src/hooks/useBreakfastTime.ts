import { useEffect, useState } from "react";
import { isBreakfastTime, msUntilBreakfastFlip } from "@apetite/shared";

/**
 * Идёт ли «утро до 10:00» (время пилотного города): от этого зависит вкладка «Завтрак». Переключается ровно на границе —
 * таймером до 10:00 и до следующей полуночи, а не опросом раз в полминуты, поэтому вкладка исчезает именно в 10:00:00.
 */
export function useBreakfastTime(): boolean {
  const [active, setActive] = useState(() => isBreakfastTime());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      setActive(isBreakfastTime());
      // +300 мс запаса: таймер не должен сработать на долю секунды раньше границы и увидеть прежнее состояние.
      timer = setTimeout(schedule, Math.min(msUntilBreakfastFlip() + 300, 2_000_000_000));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return active;
}
