import { isNetworkError } from "../api/client";
import { ordersApi } from "../api/orders";

/** Не удалось ни получить ответ на заказ, ни проверить, создан ли он: повторять вслепую нельзя. */
export class OrderOutcomeUnknownError extends Error {
  constructor() {
    super("Не удалось подтвердить результат оплаты. Прежде чем повторять, проверьте раздел «Мои заказы» — возможно, заказ уже оформлен.");
    this.name = "OrderOutcomeUnknownError";
  }
}

/**
 * Единая точка покупки для оформления и «заказа в 1 клик». Возвращает id созданного заказа.
 *
 * У POST /orders нет ключа идемпотентности. Если ответ потерялся по пути (сеть моргнула уже ПОСЛЕ того,
 * как сервер провёл оплату), слепой повтор списал бы деньги дважды — поэтому при сетевой ошибке сначала
 * сверяемся со списком заказов и, если заказ уже есть, возвращаем его.
 */
export async function placeOrder(offerId: string, quantity = 1): Promise<string> {
  const startedAt = Date.now();
  try {
    const order = await ordersApi.create({ offerId, quantity });
    return order.id;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    let orders;
    try {
      orders = await ordersApi.list();
    } catch {
      throw new OrderOutcomeUnknownError();
    }
    const created = orders.find((o) => o.offerId === offerId && new Date(o.createdAt).getTime() >= startedAt - 5000);
    if (created) return created.id;
    throw error;
  }
}
