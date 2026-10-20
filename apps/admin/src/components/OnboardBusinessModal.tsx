import { useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";
import { OfferCategory } from "@apetite/shared";
import { Modal } from "./Modal";
import { AddressField } from "./AddressField";
import { businessesApi } from "../api/businesses";
import { ApiError } from "../api/client";
import { CATEGORY_LABELS } from "../constants";

interface OnboardBusinessModalProps {
  onClose: () => void;
  onSaved: () => void;
}

// Санкт-Петербург (пилотный город, см. apps/web PhoneMockup.tsx / apps/mobile useLocation.ts) —
// дефолт для точки на карте, пока адрес не выбран из подсказок геокодера.
const DEFAULT_LAT = 59.9311;
const DEFAULT_LNG = 30.3609;

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
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
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
        lat,
        lng,
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

        <AddressField
          address={address}
          lat={lat}
          lng={lng}
          onChange={(next) => {
            setAddress(next.address);
            setLat(next.lat);
            setLng(next.lng);
          }}
        />
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: -8 }}>
          Выбери адрес из подсказок или нажми <MapPin size={12} style={{ verticalAlign: -2 }} aria-hidden="true" /> рядом
          с полем, чтобы уточнить точку на карте вручную.
        </p>

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
