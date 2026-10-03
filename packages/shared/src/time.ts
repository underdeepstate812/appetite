/** Общая математика "сколько осталось" — единая для mobile (utils/time.ts) и web (карта, лендинг). */

export interface TimeLeft {
  totalMinutes: number;
  hours: number;
  minutes: number;
  isPast: boolean;
}

export function getTimeLeft(targetIso: string, now: number = Date.now()): TimeLeft {
  const diffMs = new Date(targetIso).getTime() - now;
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
  return {
    totalMinutes,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    isPast: diffMs <= 0,
  };
}

export type UrgencyLevel = "normal" | "soon" | "urgent" | "past";

/** <1ч — urgent (совпадает с тиром +20% скидки на бэке), 1–2ч — soon, иначе normal. */
export function getUrgencyLevel(timeLeft: TimeLeft): UrgencyLevel {
  if (timeLeft.isPast) return "past";
  if (timeLeft.totalMinutes < 60) return "urgent";
  if (timeLeft.totalMinutes < 120) return "soon";
  return "normal";
}

/** Непрерывный "градус горячности" 0..1 по всему 3-часовому окну — 0 = спокойно
 * (зелёный), 1 = вот-вот сгорит (неоново-оранжевый/красный). Питает heatColor()
 * из heat.ts — плавный переход вместо резкого переключения между дискретными состояниями. */
export function getUrgencyRatio(timeLeft: TimeLeft): number {
  if (timeLeft.isPast) return 1;
  const MELT_WINDOW_MINUTES = 180;
  return Math.min(1, Math.max(0, (MELT_WINDOW_MINUTES - timeLeft.totalMinutes) / MELT_WINDOW_MINUTES));
}
