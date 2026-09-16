import { useCallback, useEffect, useState } from "react";
import type { Offer, Order } from "@apetite/shared";
import { useBusinessStore } from "../store/businessStore";
import { offersApi } from "../api/offers";
import { ordersApi } from "../api/orders";
import { ApiError } from "../api/client";
import { OrderStatusBadge } from "../components/StatusBadge";
import { LoadingView, EmptyView, ErrorView } from "../components/StateViews";

export function OrdersPage() {
  const business = useBusinessStore((state) => state.business);
  const businessLoading = useBusinessStore((state) => state.loading);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [offersById, setOffersById] = useState<Record<string, Offer>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!business) return;
    setError(null);
    try {
      const [orderList, offerList] = await Promise.all([
        ordersApi.list(),
        offersApi.list({ businessId: business.id, pageSize: 100 }),
      ]);
      setOrders(orderList);
      setOffersById(Object.fromEntries(offerList.items.map((offer) => [offer.id, offer])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить заказы");
    }
  }, [business]);

  useEffect(() => {
    void load();
  }, [load]);

  if (businessLoading || (!business && !error)) {
    return <LoadingView label="Загрузка..." />;
  }
  if (!business) {
    return <ErrorView label="Заведение не найдено для этого аккаунта" />;
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Заказы</h1>
        <p style={{ color: "var(--color-text-muted)", marginTop: 4, fontSize: 14 }}>{business.name}</p>
      </div>

      {error ? (
        <ErrorView label={error} />
      ) : orders === null ? (
        <LoadingView label="Загрузка заказов..." />
      ) : orders.length === 0 ? (
        <EmptyView label="Заказов пока нет" />
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Оффер</th>
                <th>Кол-во</th>
                <th>Сумма</th>
                <th>Создан</th>
                <th>Статус</th>
                <th>Подтверждение выдачи</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} offer={offersById[order.offerId]} onCompleted={load} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrderRow({ order, offer, onCompleted }: { order: Order; offer?: Offer; onCompleted: () => void }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const handleComplete = async () => {
    setSubmitting(true);
    setRowError(null);
    try {
      await ordersApi.complete(order.id, code);
      await onCompleted();
    } catch (completeError) {
      setRowError(completeError instanceof ApiError ? completeError.message : "Не удалось подтвердить выдачу");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{offer?.title ?? "—"}</td>
      <td>{order.quantity}</td>
      <td>{(order.totalPrice / 100).toFixed(0)} ₽</td>
      <td style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
        {new Date(order.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
      </td>
      <td>
        <OrderStatusBadge status={order.status} />
      </td>
      <td>
        {order.status === "CONFIRMED" ? (
          <div className="stack" style={{ gap: 4 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Код"
                maxLength={6}
                style={{
                  width: 84,
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  fontSize: 13,
                }}
              />
              <button
                className="btn btn-primary btn-sm"
                disabled={submitting || code.length !== 6}
                onClick={() => void handleComplete()}
              >
                {submitting ? "..." : "Выдать"}
              </button>
            </div>
            {rowError ? <span className="form-error" style={{ fontSize: 12 }}>{rowError}</span> : null}
          </div>
        ) : (
          <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>—</span>
        )}
      </td>
    </tr>
  );
}
