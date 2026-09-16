import { useEffect, useState } from "react";

/** Тикает раз в intervalMs — двигает countdown-бейджи без агрессивных ре-рендеров. */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
