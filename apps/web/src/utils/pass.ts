/** Детерминированный хэш строки в 0…1 (FNV-1a): из него выводятся номер и штрихи пропуска — у каждого пользователя свои, у одного и того же всегда те же. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

/** Номер пропуска «482 917»: шесть цифр из id пользователя. */
export function passSerial(userId: string | undefined): string {
  const n = Math.floor(hashString(`pass-${userId ?? "guest"}`) * 999_999);
  const digits = String(n).padStart(6, "0");
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/** Штрихи «штрих-кода» корешка: ширины 1…3 из того же id. */
export function passBars(userId: string | undefined, count = 42): number[] {
  return Array.from({ length: count }, (_, i) => 1 + Math.floor(hashString(`bar-${userId ?? "guest"}-${i}`) * 3));
}

/** Доля пути до следующего уровня 0…1 (на высшем уровне — 1). */
export function levelProgressRatio(points: number, level: { minPoints: number }, next: { minPoints: number } | null): number {
  if (!next) return 1;
  const span = next.minPoints - level.minPoints;
  return span > 0 ? Math.min(1, Math.max(0, (points - level.minPoints) / span)) : 1;
}

/** «сентября 2026»: месяц берём из полной даты — без дня русская локаль отдаёт «сентябрь», и «С нами с сентябрь» ломается. */
export function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  return month && year ? `${month} ${year}` : "";
}
