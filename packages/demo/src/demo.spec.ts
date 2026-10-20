import { zonedTimeToUtc } from "@apetite/shared";
import { createDemoApi, type DemoApi } from "./api";
import { DEMO_ACCOUNTS } from "./state";
import type { DemoOptions } from "./types";

const HOUR = 3_600_000;
// Понедельник 19.10.2026, 16:00 МСК
const NOW = zonedTimeToUtc("2026-10-19", "16:00", "Europe/Moscow").getTime();

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
}
function make(opts: Partial<DemoOptions> & { clock?: { now: number } } = {}) {
  const clock = opts.clock ?? { now: NOW };
  const api = createDemoApi({ apiBase: "https://demo.invalid/api/v1", assetBase: "https://demo.invalid/demo/", storage: memoryStorage(), now: () => clock.now, ...opts });
  return { api, clock };
}
type Call = (method: string, path: string, body?: unknown, token?: string | null, files?: Record<string, File>) => Promise<{ status: number; data: any }>;
const caller = (api: DemoApi): Call => (method, path, body, token = null, files = {}) => {
  const [p, q = ""] = path.split("?");
  return api.handle({ method, path: p, query: new URLSearchParams(q), body, files, token });
};
async function login(call: Call, who: { email: string; password: string }) {
  const res = await call("POST", "/auth/login", { identifier: who.email, password: who.password });
  return res.data as { accessToken: string; refreshToken: string; user: { id: string } };
}
const iso = (ms: number) => new Date(ms).toISOString();
const offerBody = (over: Record<string, unknown> = {}) => ({
  businessId: "b-pushkin", title: "Тестовый набор", category: "BAKERY", originalPriceRub: 500, baseDiscountPercent: 40, weightKg: 0.3, quantityTotal: 5,
  pickupStart: iso(NOW), pickupEnd: iso(NOW + 3 * HOUR), ingredients: "Мука, масло", allergens: ["gluten"], bestBefore: iso(NOW + 12 * HOUR), ...over,
});

describe("демо-backend: вход и профиль", () => {
  it("демо-аккаунты входят, чужой пароль — 401, /auth/me отдаёт профиль без пароля", async () => {
    const call = caller(make().api);
    const buyer = await login(call, DEMO_ACCOUNTS.buyer);
    expect(buyer.accessToken).toMatch(/^demo\./);
    expect((await call("POST", "/auth/login", { identifier: "user@apetite.ru", password: "nope" })).status).toBe(401);
    const me = await call("GET", "/auth/me", null, buyer.accessToken);
    expect(me.data).toMatchObject({ email: "user@apetite.ru", role: "USER" });
    expect(me.data.password).toBeUndefined();
    expect((await call("GET", "/auth/me")).status).toBe(401);
  });

  it("регистрация: слабый пароль, дубль email и успех; профиль правится, чужой email — 409, фото сохраняется", async () => {
    const call = caller(make().api);
    expect((await call("POST", "/auth/register", { email: "a@b.ru", password: "weak", name: "Анна" })).status).toBe(400);
    expect((await call("POST", "/auth/register", { email: "user@apetite.ru", password: "Qa!pass1234", name: "Анна" })).status).toBe(409);
    const reg = await call("POST", "/auth/register", { email: "new@b.ru", password: "Qa!pass1234", name: "Анна Новая" });
    expect(reg.status).toBe(201);
    const token = reg.data.accessToken;
    expect((await call("PATCH", "/users/me", { email: "admin@apetite.ru" }, token)).status).toBe(200); // admin@ нет в демо — разрешено
    expect((await call("PATCH", "/users/me", { email: "user@apetite.ru" }, token)).data.message).toMatch(/уже используется/);
    expect((await call("PATCH", "/users/me", { name: "А" }, token)).status).toBe(400);
    const png = new File([new Uint8Array([137, 80, 78, 71])], "a.png", { type: "image/png" });
    const withPhoto = await call("POST", "/users/me/avatar", null, token, { avatar: png });
    expect(withPhoto.data.avatarUrl).toMatch(/^data:image\/png;base64,/);
    const txt = new File(["x"], "a.txt", { type: "text/plain" });
    expect((await call("POST", "/users/me/avatar", null, token, { avatar: txt })).status).toBe(400);
  });
});

describe("демо-backend: витрина и заказ", () => {
  it("nearby: десятки живых предложений по расстоянию, фильтры работают, скидка растёт к концу окна", async () => {
    const call = caller(make().api);
    const all = (await call("GET", "/offers/nearby?lat=59.93&lng=30.33&radiusKm=60")).data as any[];
    expect(all.length).toBeGreaterThan(40);
    expect(all.every((o) => o.status === "ACTIVE" && o.quantityLeft > 0 && new Date(o.pickupEnd).getTime() > NOW)).toBe(true);
    expect([...all].sort((a, b) => a.distanceKm - b.distanceKm)).toEqual(all);
    const food = (await call("GET", "/offers/nearby?lat=59.93&lng=30.33&radiusKm=60&category=FOOD")).data as any[];
    expect(food.every((o) => o.category === "FOOD")).toBe(true);
    const hot = (await call("GET", "/offers/nearby?lat=59.93&lng=30.33&radiusKm=60&minDiscount=60")).data as any[];
    expect(hot.length).toBeGreaterThan(0);
    const last = all.filter((o) => new Date(o.pickupEnd).getTime() - NOW < HOUR && o.discountMode === "DYNAMIC");
    expect(last.every((o) => o.discountPercent === Math.min(70, o.baseDiscountPercent + 20))).toBe(true);
    expect(all[0]).toMatchObject({ businessName: expect.any(String), businessLat: expect.any(Number), distanceKm: expect.any(Number) });
  });

  it("полный путь заказа: купить → остаток уменьшился → владелец видит, принимает, выдаёт по коду → покупатель подтверждает", async () => {
    const call = caller(make().api);
    const buyer = await login(call, DEMO_ACCOUNTS.buyer);
    const owner = await login(call, DEMO_ACCOUNTS.owner);
    const before = (await call("GET", "/offers/o-pushkin-bakery")).data;
    const order = await call("POST", "/orders", { offerId: "o-pushkin-bakery", quantity: 2 }, buyer.accessToken);
    expect(order.status).toBe(201);
    expect(order.data.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(order.data.totalPrice).toBe(before.discountedPrice * 2);
    expect((await call("GET", "/offers/o-pushkin-bakery")).data.quantityLeft).toBe(before.quantityLeft - 2);
    expect((await call("POST", "/orders", { offerId: "o-pushkin-bakery", quantity: 99 }, buyer.accessToken)).status).toBe(409);
    expect((await call("POST", "/orders", { offerId: "o-pushkin-bakery", quantity: 1 }, owner.accessToken)).status).toBe(403);

    const ownerOrders = (await call("GET", "/orders", null, owner.accessToken)).data as any[];
    expect(ownerOrders.some((o) => o.id === order.data.id)).toBe(true);
    expect((await call("PATCH", `/orders/${order.data.id}/accept`, null, buyer.accessToken)).status).toBe(403);
    expect((await call("PATCH", `/orders/${order.data.id}/accept`, null, owner.accessToken)).data.acceptedAt).toBeTruthy();
    expect((await call("PATCH", `/orders/${order.data.id}/complete`, { pickupCode: "000000" }, owner.accessToken)).status).toBe(400);
    expect((await call("PATCH", `/orders/${order.data.id}/complete`, { pickupCode: order.data.pickupCode }, owner.accessToken)).data.status).toBe("COMPLETED");
    expect((await call("POST", `/orders/${order.data.id}/receipt`, { received: false }, buyer.accessToken)).status).toBe(400);
    expect((await call("POST", `/orders/${order.data.id}/receipt`, { received: true }, buyer.accessToken)).data.receiptConfirmedAt).toBeTruthy();
    expect((await call("POST", `/orders/${order.data.id}/receipt`, { received: true }, buyer.accessToken)).status).toBe(409);
    const qr = await call("GET", `/orders/${order.data.id}/qrcode`, null, buyer.accessToken);
    expect(qr.data.qrCodeDataUrl).toMatch(/^data:image/);
  });

  it("эко-профиль покупателя считается по выданным заказам; уведомления читаются", async () => {
    const call = caller(make().api);
    const buyer = await login(call, DEMO_ACCOUNTS.buyer);
    const eco = (await call("GET", "/eco/me", null, buyer.accessToken)).data;
    expect(eco.ordersCompleted).toBe(8);
    expect(eco.totalPoints).toBeGreaterThan(0);
    expect(eco.level.id).toBeGreaterThanOrEqual(1);
    const list = (await call("GET", "/notifications?unreadOnly=true", null, buyer.accessToken)).data;
    expect(list.items.length).toBe(2);
    await call("PATCH", `/notifications/${list.items[0].id}/read`, null, buyer.accessToken);
    expect((await call("GET", "/notifications?unreadOnly=true", null, buyer.accessToken)).data.items.length).toBe(1);
  });
});

describe("демо-backend: кабинет бизнеса", () => {
  it("создание оффера соблюдает правила продукта: окно ≤ 12 ч, конец в пределах суток, состав обязателен", async () => {
    const call = caller(make().api);
    const t = (await login(call, DEMO_ACCOUNTS.owner)).accessToken;
    expect((await call("POST", "/offers", offerBody(), t)).status).toBe(201);
    expect((await call("POST", "/offers", offerBody({ pickupEnd: iso(NOW + 13 * HOUR), bestBefore: iso(NOW + 30 * HOUR) }), t)).data.message).toMatch(/не длиннее 12 часов/);
    expect((await call("POST", "/offers", offerBody({ pickupStart: iso(NOW + 26 * HOUR), pickupEnd: iso(NOW + 30 * HOUR), bestBefore: iso(NOW + 40 * HOUR) }), t)).data.message).toMatch(/не может висеть дольше 24/);
    expect((await call("POST", "/offers", offerBody({ ingredients: "" }), t)).data.message).toMatch(/состав/);
    expect((await call("POST", "/offers", offerBody({ baseDiscountPercent: 10 }), t)).status).toBe(400);
    const buyer = await login(call, DEMO_ACCOUNTS.buyer);
    expect((await call("POST", "/offers", offerBody(), buyer.accessToken)).status).toBe(403);
  });

  it("часы работы: оффер за закрытием — 400, сужение часов возвращает конфликты и ничего не удаляет", async () => {
    const call = caller(make().api);
    const t = (await login(call, DEMO_ACCOUNTS.owner)).accessToken;
    const hours = { "1": { open: "10:00", close: "20:00" }, "2": null, "3": null, "4": null, "5": null, "6": null, "7": null };
    const set = await call("PUT", "/businesses/b-pushkin/working-hours", { workingHours: hours }, t);
    expect(set.status).toBe(200);
    expect(set.data.conflicts.offers.map((x: any) => x.id)).toEqual(expect.arrayContaining(["o-pushkin-dessert"])); // до 21:00 МСК — не влезает
    expect((await call("GET", "/offers/o-pushkin-dessert")).data.status).toBe("ACTIVE");
    const late = await call("POST", "/offers", offerBody({ pickupStart: iso(NOW + HOUR), pickupEnd: iso(NOW + 5 * HOUR) }), t);
    expect(late.data.message).toMatch(/закрывается в 20:00/);
    expect((await call("PUT", "/businesses/b-pushkin/working-hours", { workingHours: {} }, t)).status).toBe(400);
  });

  it("правка количества и удаление: не меньше проданного, с заказом — 409, чистый удаляется", async () => {
    const call = caller(make().api);
    const owner = (await login(call, DEMO_ACCOUNTS.owner)).accessToken;
    const buyer = (await login(call, DEMO_ACCOUNTS.buyer)).accessToken;
    const created = (await call("POST", "/offers", offerBody(), owner)).data;
    await call("POST", "/orders", { offerId: created.id, quantity: 3 }, buyer);
    expect((await call("PATCH", `/offers/${created.id}`, { quantityTotal: 2 }, owner)).data.message).toMatch(/Уже продано 3/);
    expect((await call("PATCH", `/offers/${created.id}`, { quantityTotal: 10 }, owner)).data.quantityLeft).toBe(7);
    expect((await call("DELETE", `/offers/${created.id}`, null, owner)).data.message).toMatch(/в работе \(1\)/);
    const clean = (await call("POST", "/offers", offerBody({ title: "Без заказов" }), owner)).data;
    expect((await call("DELETE", `/offers/${clean.id}`, null, owner)).data).toEqual({ success: true, skippedDate: null });
    expect((await call("GET", `/offers/${clean.id}`)).status).toBe(404);
  });

  it("автовыкладка: включённый шаблон выкладывает оффер, удаление авто-оффера пропускает дату", async () => {
    const call = caller(make().api);
    const t = (await login(call, DEMO_ACCOUNTS.owner)).accessToken;
    const schedules = (await call("GET", "/offer-schedules?businessId=b-pushkin", null, t)).data as any[];
    expect(schedules.map((s) => s.id)).toEqual(["s-breakfast", "s-evening"]);
    await call("PATCH", "/offer-schedules/s-evening", { isActive: true }, t);
    const list = (await call("GET", "/offers?businessId=b-pushkin&pageSize=100", null, t)).data.items as any[];
    const auto = list.find((o) => o.scheduleId === "s-evening");
    expect(auto).toMatchObject({ title: "Вечерняя выпечка", occurrenceDate: "2026-10-19", status: "ACTIVE" });
    const removed = (await call("DELETE", `/offers/${auto.id}`, null, t)).data;
    expect(removed).toEqual({ success: true, skippedDate: "2026-10-19" });
    const again = (await call("GET", "/offers?businessId=b-pushkin&pageSize=100", null, t)).data.items as any[];
    expect(again.some((o) => o.scheduleId === "s-evening" && o.occurrenceDate === "2026-10-19")).toBe(false);
    expect((await call("POST", "/offer-schedules", { businessId: "b-pushkin", title: "x", category: "BAKERY", originalPriceRub: 100, baseDiscountPercent: 40, discountMode: "FIXED", weightKg: 0.3, quantityTotal: 3, ingredients: "Мука", allergens: [], bestBeforeHoursAfterEnd: 6, daysOfWeek: [1], pickupStartTime: "08:00", pickupEndTime: "22:00", publishLeadMinutes: 180, timezone: "Europe/Moscow" }, t)).data.message).toMatch(/не длиннее 12/);
  });

  it("аналитика: график продаж согласован со сводкой и «когда покупают»; период проверяется", async () => {
    const call = caller(make().api);
    const t = (await login(call, DEMO_ACCOUNTS.owner)).accessToken;
    const sales = (await call("GET", "/businesses/b-pushkin/sales?days=14", null, t)).data;
    expect(sales.points).toHaveLength(14);
    expect(sales.totals.orders).toBe(sales.heat.reduce((s: number, h: any) => s + h.orders, 0));
    expect(sales.totals.revenue).toBeGreaterThan(0);
    expect(sales.comparable).toBe(true);
    expect((await call("GET", "/businesses/b-pushkin/sales?days=30", null, t)).data.comparable).toBe(false);
    expect((await call("GET", "/businesses/b-pushkin/sales?days=5", null, t)).status).toBe(400);
    const stats = (await call("GET", "/businesses/b-pushkin/stats", null, t)).data;
    expect(stats.completedOrders).toBeGreaterThan(50);
    expect(stats.revenue).toBeGreaterThan(0);
    const buyer = (await login(call, DEMO_ACCOUNTS.buyer)).accessToken;
    expect((await call("GET", "/businesses/b-pushkin/sales", null, buyer)).status).toBe(403);
  });
});

describe("демо-backend: сохранение между перезагрузками", () => {
  it("созданное остаётся при перезагрузке в течение 8 часов; позже витрина обновляется, аккаунты остаются", async () => {
    const storage = memoryStorage();
    const clock = { now: NOW };
    const first = caller(make({ storage, clock }).api);
    const owner = (await login(first, DEMO_ACCOUNTS.owner)).accessToken;
    const created = (await first("POST", "/offers", offerBody({ title: "Сохранится" }), owner)).data;
    const reg = await first("POST", "/auth/register", { email: "keep@b.ru", password: "Qa!pass1234", name: "Анна" });
    const buyerToken = reg.data.accessToken;
    await first("POST", "/orders", { offerId: "o-4", quantity: 1 }, buyerToken);

    clock.now = NOW + 2 * HOUR;
    const second = caller(make({ storage, clock }).api);
    expect((await second("GET", `/offers/${created.id}`)).data.title).toBe("Сохранится");
    expect((await second("GET", "/auth/me", null, buyerToken)).data.email).toBe("keep@b.ru");
    expect(((await second("GET", "/orders", null, buyerToken)).data as any[]).length).toBe(1);

    clock.now = NOW + 9 * HOUR;
    const third = caller(make({ storage, clock }).api);
    expect((await third("GET", `/offers/${created.id}`)).status).toBe(404);
    expect((await third("GET", "/auth/me", null, buyerToken)).data.email).toBe("keep@b.ru");
  });
});
