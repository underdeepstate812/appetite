import { useEffect, useState } from "react";
import { platformApi } from "../api/platform";
import { ApiError } from "../api/client";

/**
 * Бизнес-модель (оферта/FAQ на сайте): подключение бесплатно первые N дней — платформа
 * сама регулирует длительность здесь, без правки .env/деплоя. Значение — снимок на
 * момент онбординга конкретного заведения (Business.trialEndsAt), так что смена этой
 * настройки не задевает уже подключённые заведения задним числом.
 */
export function TrialSettingsCard() {
  const [days, setDays] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void platformApi
      .getSettings()
      .then((settings) => setDays(String(settings.trialPeriodDays)))
      .catch(() => setError("Не удалось загрузить настройки"));
  }, []);

  const handleSave = async () => {
    const value = Number(days);
    if (!Number.isInteger(value) || value < 0 || value > 365) {
      setError("Введи целое число от 0 до 365");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await platformApi.updateSettings(value);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  if (days === null) return null;

  return (
    <div className="card" style={{ padding: "16px 20px", display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="trial-days">Бесплатный период при подключении (дней)</label>
        <input
          id="trial-days"
          type="number"
          min={0}
          max={365}
          value={days}
          onChange={(event) => {
            setDays(event.target.value);
            setSaved(false);
          }}
          style={{ width: 90 }}
        />
      </div>
      <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => void handleSave()}>
        {saving ? "Сохраняем..." : "Сохранить"}
      </button>
      {saved ? <span style={{ fontSize: 13, color: "var(--color-primary)" }}>Сохранено ✓</span> : null}
      {error ? <span className="form-error">{error}</span> : null}
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", flexBasis: "100%", margin: 0 }}>
        Действует только на заведения, подключённые ПОСЛЕ изменения — уже онбордингнутым
        сохраняется срок, зафиксированный при подключении.
      </p>
    </div>
  );
}
