import { useCallback, useEffect, useState } from "react";
import type { PlatformStats } from "@apetite/shared";
import { platformApi } from "../api/platform";
import { StatCard } from "../components/StatCard";
import { LoadingView, ErrorView } from "../components/StateViews";

export function PlatformStatsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStats(await platformApi.stats());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить статистику");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>GMV платформы</h1>
        <p style={{ color: "var(--color-text-muted)", marginTop: 4, fontSize: 14 }}>По всем заведениям</p>
      </div>

      {error ? (
        <ErrorView label={error} />
      ) : !stats ? (
        <LoadingView label="Считаем..." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <StatCard label="GMV (выдано)" value={`${(stats.gmv / 100).toFixed(0)} ₽`} tone="success" />
            <StatCard label="Доход платформы" value={`${(stats.platformRevenue / 100).toFixed(0)} ₽`} tone="primary" />
            <StatCard label="Спасено еды" value={`${stats.weightSavedKg.toFixed(1)} кг`} tone="success" />
            <StatCard label="Активные офферы" value={String(stats.activeOffersCount)} tone="muted" />
          </div>

          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Заведения</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
              <StatRow label="Всего" value={stats.businessesTotal} />
              <StatRow label="Активны" value={stats.businessesActive} />
              <StatRow label="Заблокированы" value={stats.businessesSuspended} />
              <StatRow label="На модерации" value={stats.businessesPending} />
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Заказы по статусам</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
              <StatRow label="Всего" value={stats.totalOrders} />
              <StatRow label="Ожидают самовывоза" value={stats.confirmedOrders} />
              <StatRow label="Выдано" value={stats.completedOrders} />
              <StatRow label="Отменено" value={stats.cancelledOrders} />
              <StatRow label="Просрочено" value={stats.expiredOrders} />
            </div>
          </div>

          <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            GMV и доход платформы считаются только по выданным (COMPLETED) заказам, по всем заведениям сразу.
            Показатели одного заведения — в его собственной панели («Аналитика»).
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
