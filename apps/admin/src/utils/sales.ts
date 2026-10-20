import type { SalesDay, SalesHeatBucket, SalesHeatKey, SalesTotals } from "@apetite/shared";

/** Копейки → «12 480 ₽» (без копеек: на графике важны сотни, а не мелочь). */
export function formatRub(kopecks: number): string {
  return `${Math.round(kopecks / 100).toLocaleString("ru-RU")} ₽`;
}

/** Подпись оси, рубли: «1,5 тыс.», «850». */
export function axisLabel(rub: number): string {
  if (rub >= 1000) {
    const k = rub / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1).replace(".", ",")} тыс.`;
  }
  return String(rub);
}

/** «Красивый» верх оси (1/2/2,5/5 × 10ⁿ) и шаг: линии сетки падают на круглые числа. Рубли. */
export function niceAxis(maxRub: number, ticks = 4): { max: number; step: number } {
  if (maxRub <= 0) return { max: ticks * 100, step: 100 };
  const rough = maxRub / ticks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((candidate) => candidate >= rough) ?? 10 * pow;
  return { max: step * Math.ceil(maxRub / step - 1e-9), step };
}

const WEEKDAY = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" });
const DAY_MONTH = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
const parse = (date: string) => new Date(`${date}T12:00:00Z`);

export const weekdayShort = (date: string) => WEEKDAY.format(parse(date));
const MONTH_SHORT = new Intl.DateTimeFormat("ru-RU", { month: "short", timeZone: "UTC" });
export const monthShort = (date: string) => MONTH_SHORT.format(parse(date)).replace(".", "");
export const dayNumber = (date: string) => String(Number(date.slice(8, 10)));
export const isWeekend = (date: string) => [0, 6].includes(parse(date).getUTCDay());
export const longDay = (date: string) => `${weekdayShort(date)}, ${DAY_MONTH.format(parse(date))}`;

export const soldRevenue = (day: SalesDay) => day.completedRevenue + day.pendingRevenue;
export const soldOrders = (day: SalesDay) => day.completedOrders + day.pendingOrders;

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
export const ordersWord = (n: number) => `${n} ${plural(n, "заказ", "заказа", "заказов")}`;
export const portionsWord = (n: number) => `${n} ${plural(n, "порция", "порции", "порций")}`;

/** Меньше стольких заказов в прошлом периоде процент ничего не значит («+399%» с 3 заказов) — показываем только суммы. */
export const DELTA_MIN_PREVIOUS_ORDERS = 5;

/** Сравнение с прошлым периодом: null — сравнивать не с чем (честно молчим, а не рисуем «+∞%»). */
export function deltaPercent(current: SalesTotals, previous: SalesTotals): number | null {
  if (previous.revenue <= 0 || previous.orders < DELTA_MIN_PREVIOUS_ORDERS) return null;
  return Math.round(((current.revenue - previous.revenue) / previous.revenue) * 100);
}

/** Самый сильный день периода по проданному; null, если продаж не было. */
export function bestDay(points: SalesDay[]): SalesDay | null {
  let best: SalesDay | null = null;
  for (const point of points) if (soldRevenue(point) > 0 && (!best || soldRevenue(point) > soldRevenue(best))) best = point;
  return best;
}

/** Тепло = время, как во всём продукте: «давно до конца» — мята, «меньше часа» — ember. */
export const HEAT_META: Record<SalesHeatKey, { label: string; hint: string; color: string }> = {
  over4: { label: "больше 4 ч", hint: "заранее", color: "var(--heat-1)" },
  h2to4: { label: "2–4 ч", hint: "скидка базовая", color: "var(--heat-2)" },
  h1to2: { label: "1–2 ч", hint: "скидка +10 п.п.", color: "var(--heat-3)" },
  under1: { label: "меньше часа", hint: "скидка +20 п.п.", color: "var(--heat-4)" },
};

/** Минимум заказов, начиная с которого делаем выводы о «когда покупают»; меньше — только цифры. */
export const HEAT_MIN_ORDERS = 5;

export function heatInsight(heat: SalesHeatBucket[]): string | null {
  const total = heat.reduce((sum, bucket) => sum + bucket.orders, 0);
  if (total < HEAT_MIN_ORDERS) return null;
  const last2 = heat.filter((bucket) => bucket.key === "h1to2" || bucket.key === "under1").reduce((sum, bucket) => sum + bucket.orders, 0);
  const share = Math.round((last2 / total) * 100);
  const early = Math.round(((heat.find((bucket) => bucket.key === "over4")?.orders ?? 0) / total) * 100);
  if (share >= 50) return `${share}% заказов оформлено в последние 2 часа — на самой горячей цене.`;
  if (early >= 50) return `${early}% заказов оформлено больше чем за 4 часа до конца: покупатели берут заранее, не дожидаясь скидки.`;
  return `В последние 2 часа до конца оформлено ${share}% заказов, остальные — раньше.`;
}
