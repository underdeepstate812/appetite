/**
 * Замкнутая "живая" горизонталь: окружность, у которой радиус гуляет по углу, — как изолиния
 * на карте. Общий язык: фон пропуска, арт миниатюры без фото, иконка "Карта" в доке.
 */
export function contour(cx: number, cy: number, r: number, phase: number, squash = 0.82, steps = 48): string {
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const k = 1 + 0.13 * Math.sin(3 * a + phase) + 0.06 * Math.sin(5 * a + phase * 1.7);
    points.push(`${i === 0 ? "M" : "L"}${(cx + r * k * Math.cos(a)).toFixed(1)} ${(cy + r * k * Math.sin(a) * squash).toFixed(1)}`);
  }
  return `${points.join(" ")} Z`;
}

/** Стабильное число по строке (id оффера → фаза изолиний): у каждого предложения свой рисунок. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}
