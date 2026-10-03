import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, CircleX, Hourglass, Receipt, RotateCw, type LucideIcon } from "lucide-react";
import { OrderStatus, type Order } from "@apetite/shared";
import { offersApi } from "../api/offers";
import { ordersApi } from "../api/orders";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatRub } from "../utils/format";

const STATUS_META: Record<OrderStatus, { label: string; tone: string; Icon: LucideIcon }> = {
  [OrderStatus.CONFIRMED]: { label: "Ожидает самовывоза", tone: "active", Icon: Receipt },
  [OrderStatus.COMPLETED]: { label: "Забран", tone: "done", Icon: CircleCheck },
  [OrderStatus.CANCELLED]: { label: "Отменён", tone: "muted", Icon: CircleX },
  [OrderStatus.EXPIRED]: { label: "Просрочен", tone: "warn", Icon: Hourglass },
};

/** Названий офферов в заказе нет (только offerId) — подтягиваем для читаемого списка, но не больше стольких, чтобы не завалить API. */
const MAX_TITLE_LOOKUPS = 30;

export function OrdersPage() {
  usePageTitle("Мои заказы — Appetite");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await ordersApi.list();
      setOrders(data);
      const ids = [...new Set(data.map((o) => o.offerId))].slice(0, MAX_TITLE_LOOKUPS);
      const results = await Promise.allSettled(ids.map((id) => offersApi.get(id)));
      const next: Record<string, string> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled") next[ids[index]] = result.value.title;
      });
      setTitles(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить заказы");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="app-page orders-page">
      <h1 className="app-title">Мои заказы</h1>

      {error ? (
        <div className="card app-state" role="alert">
          <p>{error}</p>
          <div className="app-state-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void load()}>
              <RotateCw size={15} aria-hidden="true" /> Повторить
            </button>
          </div>
        </div>
      ) : orders === null ? (
        <div className="app-loading" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" /> Загрузка…
        </div>
      ) : orders.length === 0 ? (
        <div className="card app-state">
          <h2>Заказов пока нет</h2>
          <p>Найдите предложение на карте и заберите его со скидкой.</p>
          <div className="app-state-actions">
            <Link to="/map" className="btn btn-primary">
              Открыть карту
            </Link>
          </div>
        </div>
      ) : (
        <ul className="orders-list">
          {orders.map((order) => {
            const meta = STATUS_META[order.status];
            return (
              <li key={order.id}>
                <Link to={`/orders/${order.id}`} className={`order-card is-${meta.tone}`}>
                  <span className="order-card-icon">
                    <meta.Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="order-card-main">
                    <span className="order-card-title">{titles[order.offerId] ?? "Заказ"}</span>
                    <span className="order-card-date">{new Date(order.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                  <span className="order-card-side">
                    <strong>{formatRub(order.totalPrice)}</strong>
                    <span className="order-card-status">{meta.label}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
