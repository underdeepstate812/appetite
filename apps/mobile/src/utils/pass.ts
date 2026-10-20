import { hashString } from "./contour";

/** Номер пропуска «482 917» — шесть цифр, выведенных из id пользователя: у каждого свой, у одного и того же — всегда один. */
export function passSerial(userId: string | undefined): string {
  const n = Math.floor(hashString(`pass-${userId ?? "guest"}`) * 999_999);
  const digits = String(n).padStart(6, "0");
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/** Штрихи «штрих-кода» корешка: ширины 1…3 из того же id — рисунок на корешке принадлежит этому пропуску. */
export function passBars(userId: string | undefined, count = 42): number[] {
  return Array.from({ length: count }, (_, i) => 1 + Math.floor(hashString(`bar-${userId ?? "guest"}-${i}`) * 3));
}

/** Доля пути до следующего уровня 0…1 (на высшем уровне — 1). */
export function levelProgressRatio(points: number, level: { minPoints: number }, next: { minPoints: number } | null): number {
  if (!next) return 1;
  const span = next.minPoints - level.minPoints;
  return span > 0 ? Math.min(1, Math.max(0, (points - level.minPoints) / span)) : 1;
}
