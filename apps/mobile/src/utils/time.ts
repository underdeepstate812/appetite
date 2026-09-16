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
