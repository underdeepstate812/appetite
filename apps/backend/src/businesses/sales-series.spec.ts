import { buildSalesSeries, salesWindowStart } from "@apetite/shared";

const HOUR = 3_600_000;
// 18.10.2026 15:00 МСК
const NOW = Date.UTC(2026, 9, 18, 12, 0);
const order = (over: Partial<Parameters<typeof buildSalesSeries>[0][number]> = {}) => ({
  createdAt: NOW - HOUR, status: "COMPLETED", totalPrice: 10000, quantity: 1, offerPickupEnd: NOW + 5 * HOUR, ...over,
});

describe("buildSalesSeries", () => {
  it("возвращает ровно N дней по возрастанию, последний — сегодня по Москве, без пропусков", () => {
    const { points } = buildSalesSeries([], { days: 7, now: NOW });
    expect(points).toHaveLength(7);
    expect(points[6].date).toBe("2026-10-18");
    expect(points[0].date).toBe("2026-10-12");
  });

  it("делит по статусам: выдано / ждёт выдачи / потеряно; потерянное не входит в «проданное»", () => {
    const r = buildSalesSeries(
      [order({ totalPrice: 10000, quantity: 2 }), order({ status: "CONFIRMED", totalPrice: 5000 }), order({ status: "CANCELLED", totalPrice: 7000 }), order({ status: "EXPIRED", totalPrice: 1000 })],
      { days: 7, now: NOW }
    );
    expect(r.points[6]).toMatchObject({ completedRevenue: 10000, pendingRevenue: 5000, lostRevenue: 8000, completedOrders: 1, pendingOrders: 1, lostOrders: 2, portions: 3 });
    expect(r.totals).toEqual({ revenue: 15000, orders: 2, portions: 3 });
  });

  it("день определяется по московскому времени: 23:30 МСК вчера ≠ 00:30 МСК сегодня (UTC-даты те же)", () => {
    const lateYesterday = Date.UTC(2026, 9, 17, 20, 30); // 23:30 МСК 17-го
    const earlyToday = Date.UTC(2026, 9, 17, 21, 30); // 00:30 МСК 18-го
    const r = buildSalesSeries([order({ createdAt: lateYesterday }), order({ createdAt: earlyToday })], { days: 7, now: NOW });
    expect(r.points[5].completedOrders).toBe(1);
    expect(r.points[6].completedOrders).toBe(1);
  });

  it("предыдущий период такой же длины считается отдельно, всё остальное игнорируется", () => {
    const r = buildSalesSeries(
      [order({ createdAt: NOW - 8 * 24 * HOUR, totalPrice: 4000 }), order({ createdAt: NOW - 13 * 24 * HOUR, totalPrice: 1000 }), order({ createdAt: NOW - 14 * 24 * HOUR, totalPrice: 9999 }), order({ createdAt: NOW - 9 * 24 * HOUR, status: "CANCELLED", totalPrice: 777 })],
      { days: 7, now: NOW }
    );
    expect(r.previous).toEqual({ revenue: 5000, orders: 2, portions: 2 });
    expect(r.totals.revenue).toBe(0);
  });

  it("«когда покупают»: корзины по часам до конца совпадают со ступенями скидки (4 / 2 / 1 ч)", () => {
    const at = (h: number) => order({ offerPickupEnd: NOW - HOUR + h * HOUR });
    const r = buildSalesSeries([at(6), at(4), at(3), at(2), at(1.5), at(1), at(0.5), at(0), order({ status: "CANCELLED", offerPickupEnd: NOW })], { days: 7, now: NOW });
    expect(r.heat.map((b) => [b.key, b.orders])).toEqual([["over4", 2], ["h2to4", 2], ["h1to2", 2], ["under1", 2]]);
  });

  it("окно запроса начинается с 00:00 МСК первого дня предыдущего периода", () => {
    expect(salesWindowStart(7, NOW).toISOString()).toBe("2026-10-04T21:00:00.000Z"); // 05.10 00:00 МСК
  });

  it("сравнение честное: только если первый заказ заведения старше начала предыдущего периода", () => {
    // days=7: предыдущий период начинается 5.10 00:00 МСК
    expect(buildSalesSeries([], { days: 7, now: NOW, firstOrderAt: NOW - 20 * 24 * HOUR }).comparable).toBe(true);
    expect(buildSalesSeries([], { days: 7, now: NOW, firstOrderAt: NOW - 10 * 24 * HOUR }).comparable).toBe(false);
    expect(buildSalesSeries([], { days: 7, now: NOW, firstOrderAt: null }).comparable).toBe(false);
    expect(buildSalesSeries([], { days: 7, now: NOW }).comparable).toBe(false);
  });
});
