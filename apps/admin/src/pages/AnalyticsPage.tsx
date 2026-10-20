import { useCallback, useEffect, useState } from "react";
import type { BusinessStats } from "@apetite/shared";
import { useBusinessStore } from "../store/businessStore";
import { businessesApi } from "../api/businesses";
import { StatCard } from "../components/StatCard";
import { SalesPanel } from "../components/SalesPanel";
import { LoadingView, ErrorView } from "../components/StateViews";

export function AnalyticsPage() {
  const business = useBusinessStore((state) => state.business);
  const businessLoading = useBusinessStore((state) => state.loading);
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!business) return;
    setError(null);
    try {
      setStats(await businessesApi.stats(business.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить аналитику");
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
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Аналитика</h1>
        <p style={{ color: "var(--color-text-muted)", marginTop: 4, fontSize: 14 }}>{business.name}</p>
      </div>

      {error ? (
        <ErrorView label={error} />
      ) : !stats ? (
        <LoadingView label="Считаем..." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <StatCard label="Активные офферы" value={String(stats.activeOffersCount)} tone="primary" />
            <StatCard label="Выручка (выдано)" value={`${(stats.revenue / 100).toFixed(0)} ₽`} tone="success" />
            <StatCard label="Комиссия платформы" value={`${(stats.platformFee / 100).toFixed(0)} ₽`} tone="muted" />
            <StatCard label="Спасено еды" value={`${stats.weightSavedKg.toFixed(1)} кг`} tone="success" />
          </div>

          <SalesPanel businessId={business.id} />

          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Заказы по статусам</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
              <StatRow label="Всего" value={stats.totalOrders} />
              <StatRow label="Ожидают самовывоза" value={stats.confirmedOrders} />
              <StatRow label="Выдано" value={stats.completedOrders} />
              <StatRow label="Отменено" value={stats.cancelledOrders} />
              <StatRow label="Просрочено" value={stats.expiredOrders} />
              <StatRow label="Оспорено покупателем" value={stats.disputedOrders} />
            </div>
          </div>

          <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            Выручка и комиссия считаются только по выданным (COMPLETED) заказам. Платформенная сводка GMV по всем
            заведениям — в панели платформы (ШАГ 11).
          </p>
        </>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{value}</p>
    </div>
  );
}
