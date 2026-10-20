const sameLocalDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

export interface PickupLabels {
  /** «завтра» / «tomorrow» — подставляется, когда окно переходит на другой день. */
  tomorrow: string;
  locale: string;
}

function clock(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

/** «17:35–18:35» или, если окно закрывается не в тот же день, «17:35 — завтра 18:35» (суточное «предложение дня»). */
export function formatPickupWindow(startIso: string, endIso: string, labels: PickupLabels): string {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return sameLocalDay(start, end)
    ? `${clock(startIso, labels.locale)}–${clock(endIso, labels.locale)}`
    : `${clock(startIso, labels.locale)} — ${labels.tomorrow} ${clock(endIso, labels.locale)}`;
}

/** Крайний срок для фразы «заберите до …»: «18:35» или, если окно закрывается завтра, «завтра 18:35». */
export function formatPickupDeadline(startIso: string, endIso: string, labels: PickupLabels): string {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return sameLocalDay(start, end) ? clock(endIso, labels.locale) : `${labels.tomorrow} ${clock(endIso, labels.locale)}`;
}

/** Доля окна самовывоза, которая ещё осталась (1 — окно только началось, 0 — закрылось). До открытия окна — 1. */
export function windowRemaining(startIso: string, endIso: string, now: number): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (end <= start || now >= end) return 0;
  if (now <= start) return 1;
  return (end - now) / (end - start);
}

/** Откроется ли окно самовывоза позже, чем «сейчас» (заказать можно заранее, забрать — только с этого момента). */
export function windowOpensLater(startIso: string, now: number): boolean {
  return new Date(startIso).getTime() > now;
}
