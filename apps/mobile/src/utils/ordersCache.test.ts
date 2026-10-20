import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadOrders, MAX_CACHED_ORDERS, saveOrders, upsertOrder } from "./ordersCache";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const order = (id: string, over: Record<string, unknown> = {}) => ({ id, userId: "u1", offerId: `o-${id}`, businessId: "b1", quantity: 1, totalPrice: 100, status: "CONFIRMED", pickupCode: "123456", createdAt: "2026-10-04T09:00:00Z", ...over }) as never;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("ordersCache", () => {
  it("round-trips the list with the labels for its rows", async () => {
    await saveOrders({ userId: "u1", savedAt: "2026-10-04T09:00:00Z", orders: [order("1")], titles: { "o-1": "Набор" }, venues: { b1: "Кафе" } });
    const loaded = await loadOrders("u1");
    expect(loaded?.orders).toHaveLength(1);
    expect(loaded?.titles["o-1"]).toBe("Набор");
    expect(loaded?.venues.b1).toBe("Кафе");
  });

  it("is invisible to another account", async () => {
    await saveOrders({ userId: "u1", savedAt: "x", orders: [order("1")], titles: {}, venues: {} });
    expect(await loadOrders("u2")).toBeNull();
    expect(await loadOrders(null)).toBeNull();
  });

  it("keeps only the latest orders", async () => {
    const many = Array.from({ length: MAX_CACHED_ORDERS + 10 }, (_, i) => order(String(i)));
    await saveOrders({ userId: "u1", savedAt: "x", orders: many, titles: {}, venues: {} });
    const loaded = await loadOrders("u1");
    expect(loaded?.orders).toHaveLength(MAX_CACHED_ORDERS);
    expect(loaded?.orders[0].id).toBe("0");
  });

  it("puts a freshly paid order first, even when there was no saved list yet", async () => {
    await upsertOrder("u1", order("new"), { title: "Новый", venue: "Кафе" });
    const loaded = await loadOrders("u1");
    expect(loaded?.orders.map((o) => o.id)).toEqual(["new"]);
    expect(loaded?.titles["o-new"]).toBe("Новый");
  });

  it("adds the new order in front of the saved ones and replaces a duplicate", async () => {
    await saveOrders({ userId: "u1", savedAt: "x", orders: [order("1"), order("2")], titles: { "o-1": "Первый" }, venues: {} });
    await upsertOrder("u1", order("2", { status: "COMPLETED" }), {});
    await upsertOrder("u1", order("3"), { title: "Третий" });
    const loaded = await loadOrders("u1");
    expect(loaded?.orders.map((o) => o.id)).toEqual(["3", "2", "1"]);
    expect(loaded?.orders[1].status).toBe("COMPLETED");
    expect(loaded?.titles).toMatchObject({ "o-1": "Первый", "o-3": "Третий" });
  });

  it("a save of the whole list and an upsert of a new order running together lose neither", async () => {
    await Promise.all([
      saveOrders({ userId: "u1", savedAt: "x", orders: [order("1"), order("2")], titles: {}, venues: {} }),
      upsertOrder("u1", order("new"), { title: "Новый" }),
    ]);
    const loaded = await loadOrders("u1");
    // порядок задан очередью: сначала список, затем добавление — новый заказ впереди, старые на месте
    expect(loaded?.orders.map((o) => o.id)).toEqual(["new", "1", "2"]);
  });
});
