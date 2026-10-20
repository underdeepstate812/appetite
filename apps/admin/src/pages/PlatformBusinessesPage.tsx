import { useCallback, useEffect, useState } from "react";
import { BusinessStatus, type PlatformBusinessSummary } from "@apetite/shared";
import { platformApi } from "../api/platform";
import { businessesApi } from "../api/businesses";
import { ApiError } from "../api/client";
import { BusinessStatusBadge } from "../components/StatusBadge";
import { LoadingView, EmptyView, ErrorView } from "../components/StateViews";
import { OnboardBusinessModal } from "../components/OnboardBusinessModal";
import { TrialSettingsCard } from "../components/TrialSettingsCard";
import { CATEGORY_LABELS } from "../constants";

export function PlatformBusinessesPage() {
  const [businesses, setBusinesses] = useState<PlatformBusinessSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBusinesses(await platformApi.listBusinesses());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить заведения");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggleStatus = async (business: PlatformBusinessSummary) => {
    const nextStatus = business.status === "SUSPENDED" ? BusinessStatus.ACTIVE : BusinessStatus.SUSPENDED;
    const verb = nextStatus === BusinessStatus.SUSPENDED ? "заблокировать" : "разблокировать";
    if (!confirm(`Точно ${verb} «${business.name}»?`)) return;
    await businessesApi.update(business.id, { status: nextStatus });
    await load();
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Заведения</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: 4, fontSize: 14 }}>Модерация и комиссия</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowOnboard(true)}>
          + Онбординг заведения
        </button>
      </div>

      <TrialSettingsCard />

      {error ? (
        <ErrorView label={error} />
      ) : businesses === null ? (
        <LoadingView label="Загрузка..." />
      ) : businesses.length === 0 ? (
        <EmptyView label="Заведений пока нет" />
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Категория</th>
                <th>Статус</th>
                <th>Комиссия</th>
                <th>Выдано заказов</th>
                <th>Выручка</th>
                <th>Доход платформы</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {businesses.map((business) => (
                <BusinessRow key={business.id} business={business} onChanged={load} onToggleStatus={handleToggleStatus} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showOnboard ? (
        <OnboardBusinessModal
          onClose={() => setShowOnboard(false)}
          onSaved={() => {
            setShowOnboard(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function BusinessRow({
  business,
  onChanged,
  onToggleStatus,
}: {
  business: PlatformBusinessSummary;
  onChanged: () => void;
  onToggleStatus: (business: PlatformBusinessSummary) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [commission, setCommission] = useState(String(business.commissionPercent));
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const inTrial = business.trialEndsAt !== null && new Date(business.trialEndsAt) > new Date();

  const handleSaveCommission = async () => {
    setSaving(true);
    setRowError(null);
    try {
      await businessesApi.update(business.id, { commissionPercent: Number(commission) });
      setEditing(false);
      onChanged();
    } catch (saveError) {
      setRowError(saveError instanceof ApiError ? saveError.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{business.name}</td>
      <td>{CATEGORY_LABELS[business.category]}</td>
      <td>
        <BusinessStatusBadge status={business.status} />
      </td>
      <td>
        {editing ? (
          <div className="stack" style={{ gap: 4 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number"
                min={0}
                max={100}
                value={commission}
                onChange={(event) => setCommission(event.target.value)}
                style={{
                  width: 60,
                  padding: "6px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  fontSize: 13,
                }}
              />
              <span style={{ fontSize: 13 }}>%</span>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => void handleSaveCommission()}>
                ✓
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setCommission(String(business.commissionPercent));
                }}
              >
                ✕
              </button>
            </div>
            {rowError ? <span className="form-error" style={{ fontSize: 12 }}>{rowError}</span> : null}
          </div>
        ) : (
          <div className="stack" style={{ gap: 4 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              {business.commissionPercent}%
            </button>
            {inTrial ? (
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                пробный период до {formatDate(business.trialEndsAt!)}
              </span>
            ) : null}
          </div>
        )}
      </td>
      <td>{business.ordersCompleted}</td>
      <td>{(business.revenue / 100).toFixed(0)} ₽</td>
      <td>
        <span style={{ fontWeight: 600 }}>{(business.platformFee / 100).toFixed(0)} ₽</span>
        {inTrial ? (
          <span style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)" }}>подключение бесплатно</span>
        ) : null}
      </td>
      <td>
        <button
          className={business.status === "SUSPENDED" ? "btn btn-secondary btn-sm" : "btn btn-danger btn-sm"}
          onClick={() => onToggleStatus(business)}
        >
          {business.status === "SUSPENDED" ? "Разблокировать" : "Заблокировать"}
        </button>
      </td>
    </tr>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
