import { useEffect, useState } from "react";

/** Текущее время, обновляемое раз в intervalMs — для живых таймеров («осталось 25 мин») без ручных setInterval. */
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
