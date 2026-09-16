import { useState, type FormEvent } from "react";
import { OfferCategory } from "@apetite/shared";
import { Modal } from "./Modal";
import { businessesApi } from "../api/businesses";
import { ApiError } from "../api/client";
import { CATEGORY_LABELS } from "../constants";

interface OnboardBusinessModalProps {
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Ручной онбординг (ШАГ 0/11): один запрос создаёт и владельца (роль BUSINESS),
 * и само заведение сразу в статусе ACTIVE — self-signup вне скоупа беты.
 */
export function OnboardBusinessModal({ onClose, onSaved }: OnboardBusinessModalProps) {
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<OfferCategory>(OfferCategory.FOOD);
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("55.7558");
  const [lng, setLng] = useState("37.6173");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await businessesApi.create({
        ownerEmail,
        ownerPassword,
        ownerName,
        name,
        category,
        address,
        lat: Number(lat),
        lng: Number(lng),
      });
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Не удалось создать заведение");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Онбординг заведения" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)} className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="name">Название заведения</label>
          <input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="category">Категория</label>
          <select id="category" value={category} onChange={(event) => setCategory(event.target.value as OfferCategory)}>
            {Object.values(OfferCategory).map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="address">Адрес</label>
          <input id="address" value={address} onChange={(event) => setAddress(event.target.value)} required />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="field">
            <label htmlFor="lat">Широта</label>
            <input id="lat" type="number" step="0.000001" value={lat} onChange={(event) => setLat(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="lng">Долгота</label>
            <input id="lng" type="number" step="0.000001" value={lng} onChange={(event) => setLng(event.target.value)} required />
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>Учётная запись владельца</p>

        <div className="field">
          <label htmlFor="ownerName">Имя владельца</label>
          <input id="ownerName" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="ownerEmail">Email владельца</label>
          <input
            id="ownerEmail"
            type="email"
            value={ownerEmail}
            onChange={(event) => setOwnerEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="ownerPassword">Пароль (минимум 8 символов)</label>
          <input
            id="ownerPassword"
            type="password"
            minLength={8}
            value={ownerPassword}
            onChange={(event) => setOwnerPassword(event.target.value)}
            required
          />
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ flex: 1 }}>
            {saving ? "Создаём..." : "Создать заведение"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
