import { addDays, zonedParts, zonedTimeToUtc } from "./schedule";

/** Периоды графика продаж, дни. */
export const SALES_PERIODS = [7, 14, 30] as const;
export type SalesPeriod = (typeof SALES_PERIODS)[number];

/** Пояс, в котором бизнес видит «сегодня»; у заведения собственного пояса пока нет — как и у вкладки «Завтрак». */
export const SALES_TIME_ZONE = "Europe/Moscow";

/**
 * Один день графика. День — когда сделана покупка (createdAt), а не когда её выдали: график отвечает на вопрос
 * «когда у меня покупают». Деньги — копейки.
 * completed — выдано; pending — оплачено и ждёт выдачи; lost — отменено или просрочено (деньги не получены).
 */
export interface SalesDay {
  /** «YYYY-MM-DD» в поясе SALES_TIME_ZONE. */
  date: string;
  completedRevenue: number;
  pendingRevenue: number;
  lostRevenue: number;
  completedOrders: number;
  pendingOrders: number;
  lostOrders: number;
  /** Порции в выданных и ожидающих заказах — сколько еды реально ушло людям, а не в мусор. */
  portions: number;
}

/**
 * «Когда покупают»: за сколько часов до конца самовывоза оформлен заказ. Границы совпадают со ступенями
 * динамической скидки (за 2 ч и за 1 ч до конца), поэтому видно, сколько продаж приносит «горячая» цена.
 */
export type SalesHeatKey = "over4" | "h2to4" | "h1to2" | "under1";
export const SALES_HEAT_BUCKETS: ReadonlyArray<{ key: SalesHeatKey; minHours: number; maxHours: number }> = [
  { key: "over4", minHours: 4, maxHours: Infinity },
  { key: "h2to4", minHours: 2, maxHours: 4 },
  { key: "h1to2", minHours: 1, maxHours: 2 },
  { key: "under1", minHours: 0, maxHours: 1 },
];
export interface SalesHeatBucket {
  key: SalesHeatKey;
  orders: number;
  /** Копейки. */
  revenue: number;
}

export interface SalesTotals {
  /** Проданное = выдано + ждёт выдачи (без отменённых и просроченных), копейки. */
  revenue: number;
  orders: number;
  portions: number;
}

/** GET /businesses/:id/sales?days=7|14|30 */
export interface BusinessSales {
  days: number;
  timeZone: string;
  points: SalesDay[];
  totals: SalesTotals;
  /** Такой же по длине период прямо перед текущим — для сравнения «было/стало». */
  previous: SalesTotals;
  /**
   * Можно ли честно сравнивать с previous: первый заказ заведения старше начала предыдущего периода.
   * Иначе заведение просто ещё не работало, и «+400%» было бы арифметикой пустоты.
   */
  comparable: boolean;
  heat: SalesHeatBucket[];
}

export interface SalesOrderInput {
  createdAt: Date | number;
  /** OrderStatus: CONFIRMED | COMPLETED | CANCELLED | EXPIRED */
  status: string;
  totalPrice: number;
  quantity: number;
  offerPickupEnd: Date | number;
}

const ms = (value: Date | number) => (typeof value === "number" ? value : value.getTime());

const emptyDay = (date: string): SalesDay => ({
  date,
  completedRevenue: 0,
  pendingRevenue: 0,
  lostRevenue: 0,
  completedOrders: 0,
  pendingOrders: 0,
  lostOrders: 0,
  portions: 0,
});

/** Начало окна запроса (UTC): 00:00 первого дня предыдущего периода — чтобы одним запросом получить оба периода. */
export function salesWindowStart(days: number, now: number, timeZone: string = SALES_TIME_ZONE): Date {
  const today = zonedParts(now, timeZone).date;
  return zonedTimeToUtc(addDays(today, -(2 * days - 1)), "00:00", timeZone);
}

/** Чистая сборка графика из заказов: тестируется без БД. Заказы вне двух периодов игнорируются. */
export function buildSalesSeries(orders: SalesOrderInput[], opts: { days: number; now: number; timeZone?: string; firstOrderAt?: Date | number | null }): BusinessSales {
  const timeZone = opts.timeZone ?? SALES_TIME_ZONE;
  const today = zonedParts(opts.now, timeZone).date;
  const firstDate = addDays(today, -(opts.days - 1));
  const previousFirstDate = addDays(today, -(2 * opts.days - 1));

  const points: SalesDay[] = Array.from({ length: opts.days }, (_, index) => emptyDay(addDays(firstDate, index)));
  const byDate = new Map(points.map((point) => [point.date, point]));
  const totals: SalesTotals = { revenue: 0, orders: 0, portions: 0 };
  const previous: SalesTotals = { revenue: 0, orders: 0, portions: 0 };
  const heat: SalesHeatBucket[] = SALES_HEAT_BUCKETS.map(({ key }) => ({ key, orders: 0, revenue: 0 }));

  for (const order of orders) {
    const date = zonedParts(ms(order.createdAt), timeZone).date;
    const sold = order.status === "COMPLETED" || order.status === "CONFIRMED";
    const inCurrent = date >= firstDate && date <= today;
    const inPrevious = date >= previousFirstDate && date < firstDate;
    if (!inCurrent && !inPrevious) continue;

    if (inPrevious) {
      if (sold) {
        previous.revenue += order.totalPrice;
        previous.orders += 1;
        previous.portions += order.quantity;
      }
      continue;
    }

    const point = byDate.get(date)!;
    if (order.status === "COMPLETED") {
      point.completedRevenue += order.totalPrice;
      point.completedOrders += 1;
    } else if (order.status === "CONFIRMED") {
      point.pendingRevenue += order.totalPrice;
      point.pendingOrders += 1;
    } else {
      point.lostRevenue += order.totalPrice;
      point.lostOrders += 1;
      continue;
    }
    point.portions += order.quantity;
    totals.revenue += order.totalPrice;
    totals.orders += 1;
    totals.portions += order.quantity;

    const hoursToEnd = Math.max(0, (ms(order.offerPickupEnd) - ms(order.createdAt)) / 3_600_000);
    const index = SALES_HEAT_BUCKETS.findIndex((bucket) => hoursToEnd >= bucket.minHours && hoursToEnd < bucket.maxHours);
    if (index >= 0) {
      heat[index].orders += 1;
      heat[index].revenue += order.totalPrice;
    }
  }

  const previousStart = zonedTimeToUtc(previousFirstDate, "00:00", timeZone).getTime();
  const comparable = opts.firstOrderAt != null && ms(opts.firstOrderAt) < previousStart;
  return { days: opts.days, timeZone, points, totals, previous, comparable, heat };
}
