import type { Order } from "@apetite/shared";
import { readJson, withCacheLock, writeJson } from "./offlineCache";

/** Сохранённый список заказов — путь к билету идёт через вкладку «Заказы», и без сети она не должна оказываться пустой ошибкой. */
export interface OrdersSnapshot {
  v: 1;
  userId: string;
  savedAt: string;
  orders: Order[];
  /** Названия предложений и заведений для строк списка (offerId → название, businessId → название). */
  titles: Record<string, string>;
  venues: Record<string, string>;
}

const KEY = "orders";
/** Сколько последних заказов держим: список в офлайне нужен, чтобы найти актуальный, а не листать историю. */
export const MAX_CACHED_ORDERS = 30;

export async function loadOrders(userId: string | null | undefined): Promise<OrdersSnapshot | null> {
  if (!userId) return null;
  const snapshot = await readJson<OrdersSnapshot>(KEY);
  if (!snapshot || snapshot.v !== 1 || snapshot.userId !== userId || !Array.isArray(snapshot.orders)) return null;
  return snapshot;
}

type OrdersInput = Omit<OrdersSnapshot, "v" | "orders"> & { orders: Order[] };

const write = (snapshot: OrdersInput) => writeJson(KEY, { ...snapshot, v: 1, orders: snapshot.orders.slice(0, MAX_CACHED_ORDERS) });

export function saveOrders(snapshot: OrdersInput): Promise<void> {
  return withCacheLock(() => write(snapshot));
}

/**
 * Только что оплаченный заказ — в сохранённый список сразу: если связь пропала сразу после оплаты, вкладка «Заказы» не должна
 * показывать список без заказа, который человек только что купил.
 */
export function upsertOrder(userId: string, order: Order, labels: { title?: string; venue?: string }, now: Date = new Date()): Promise<void> {
  return withCacheLock(async () => {
    const current = await loadOrders(userId);
    const orders = [order, ...(current?.orders ?? []).filter((existing) => existing.id !== order.id)];
    await write({
      userId,
      savedAt: now.toISOString(),
      orders,
      titles: { ...(current?.titles ?? {}), ...(labels.title ? { [order.offerId]: labels.title } : {}) },
      venues: { ...(current?.venues ?? {}), ...(labels.venue ? { [order.businessId]: labels.venue } : {}) },
    });
  });
}
