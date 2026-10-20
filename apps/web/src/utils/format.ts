/** Копейки → «420 ₽» (в копейках хранятся все суммы API, см. Offer.discountedPrice). */
export function formatRub(minor: number): string {
  return `${(minor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} м` : `${km.toFixed(1).replace(".", ",")} км`;
}

/** «1 ч 05 мин» / «25 мин» / «меньше минуты». */
export function formatTimeLeft(totalMinutes: number): string {
  if (totalMinutes <= 0) return "меньше минуты";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} мин`;
  return `${hours} ч ${String(minutes).padStart(2, "0")} мин`;
}

const isSameLocalDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** «до 18:35» — а если окно закрывается не сегодня, то «до завтра 18:35» (суточное «предложение дня»). */
export function formatPickupEnd(endIso: string, now: number = Date.now()): string {
  const end = new Date(endIso).getTime();
  return isSameLocalDay(now, end) ? `до ${formatClock(endIso)}` : `до завтра ${formatClock(endIso)}`;
}

/** «17:35–18:35» или, если окно переходит на другой день, «17:35 — завтра 18:35». */
export function formatPickupWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return isSameLocalDay(start, end) ? `${formatClock(startIso)}–${formatClock(endIso)}` : `${formatClock(startIso)} — завтра ${formatClock(endIso)}`;
}
