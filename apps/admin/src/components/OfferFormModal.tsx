import { useState, type FormEvent } from "react";
import { DISCOUNT_RULES, OfferCategory, OfferStatus, type Business, type Offer } from "@apetite/shared";
import { Modal } from "./Modal";
import { OfferPhotoField } from "./OfferPhotoField";
import { offersApi } from "../api/offers";
import { ApiError } from "../api/client";
import { CATEGORY_LABELS } from "../constants";
import { computeNetPayout, isInTrial } from "../utils/commission";

interface OfferFormModalProps {
  business: Business;
  /** Если передан — режим редактирования, иначе создание нового оффера. */
  offer?: Offer;
  onClose: () => void;
  onSaved: () => void;
}

/** ISO-строка <-> значение <input type="datetime-local"> (в локальном часовом поясе браузера). */
function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

function defaultPickupStart(): string {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  return toDatetimeLocal(date.toISOString());
}

function defaultPickupEnd(): string {
  const date = new Date();
  date.setHours(date.getHours() + 2, 0, 0, 0);
  return toDatetimeLocal(date.toISOString());
}

export function OfferFormModal({ business, offer, onClose, onSaved }: OfferFormModalProps) {
  const isEdit = !!offer;
  const [title, setTitle] = useState(offer?.title ?? "");
  const [description, setDescription] = useState(offer?.description ?? "");
  const [category, setCategory] = useState<OfferCategory>(offer?.category ?? OfferCategory.FOOD);
  const [originalPriceRub, setOriginalPriceRub] = useState(offer ? String(offer.originalPrice / 100) : "");
  const [baseDiscountPercent, setBaseDiscountPercent] = useState(
    offer ? String(offer.baseDiscountPercent) : String(DISCOUNT_RULES.DEFAULT_BASE_PERCENT)
  );
  const [weightKg, setWeightKg] = useState(offer ? String(offer.weightKg) : "");
  const [quantityTotal, setQuantityTotal] = useState(offer ? String(offer.quantityTotal) : "1");
  const [pickupStart, setPickupStart] = useState(offer ? toDatetimeLocal(offer.pickupStart) : defaultPickupStart());
  const [pickupEnd, setPickupEnd] = useState(offer ? toDatetimeLocal(offer.pickupEnd) : defaultPickupEnd());
  const [status, setStatus] = useState<OfferStatus>(offer?.status ?? OfferStatus.ACTIVE);
  const [imageUrl, setImageUrl] = useState<string | null>(offer?.imageUrl ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Та же живая подсказка, что и в QuickOfferCreate — цена на витрине против того, что
  // реально дойдёт до заведения после комиссии (utils/commission.ts).
  const priceNum = Number(originalPriceRub);
  const discountNum = Number(baseDiscountPercent);
  const displayPrice = priceNum > 0 && discountNum >= 0 ? Math.round(priceNum * (1 - discountNum / 100) * 100) / 100 : null;
  const netPayout = displayPrice !== null ? computeNetPayout(displayPrice, business) : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const start = new Date(pickupStart).getTime();
    const end = new Date(pickupEnd).getTime();
    if (end <= start) {
      setError("Конец окна самовывоза должен быть позже начала");
      return;
    }
    if (!isEdit && end <= Date.now()) {
      setError("Окно самовывоза уже закончилось — выбери конец в будущем");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await offersApi.update(offer.id, {
          title,
          description: description || undefined,
          category,
          originalPriceRub: Number(originalPriceRub),
          baseDiscountPercent: Number(baseDiscountPercent),
          weightKg: Number(weightKg),
          pickupStart: fromDatetimeLocal(pickupStart),
          pickupEnd: fromDatetimeLocal(pickupEnd),
          status,
          // Фото шлём только если его меняли (null — убрать): иначе правка цены не должна трогать снимок.
          ...(imageUrl !== (offer.imageUrl ?? null) ? { imageUrl } : {}),
        });
      } else {
        await offersApi.create({
          businessId: business.id,
          title,
          description: description || undefined,
          category,
          originalPriceRub: Number(originalPriceRub),
          baseDiscountPercent: Number(baseDiscountPercent),
          weightKg: Number(weightKg),
          quantityTotal: Number(quantityTotal),
          pickupStart: fromDatetimeLocal(pickupStart),
          pickupEnd: fromDatetimeLocal(pickupEnd),
          ...(imageUrl ? { imageUrl } : {}),
        });
      }
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Не удалось сохранить оффер");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Редактировать оффер" : "Новый оффер"} onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)} className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="title">Название</label>
          <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>

        <div className="field">
          <label id="offer-photo-label">Фото</label>
          <OfferPhotoField labelledBy="offer-photo-label" value={imageUrl} onChange={setImageUrl} category={category} title={title} onBusyChange={setPhotoBusy} />
        </div>

        <div className="field">
          <label htmlFor="description">Описание (необязательно)</label>
          <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
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

        {isEdit ? (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            Текущая скидка {offer.discountPercent}% ({(offer.discountedPrice / 100).toFixed(0)} ₽) — растёт от
            стартовой автоматически по времени до конца самовывоза, максимум {DISCOUNT_RULES.MAX_PERCENT}%.
          </p>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="field">
            <label htmlFor="price">Цена без скидки, ₽</label>
            <input
              id="price"
              type="number"
              min={1}
              step="0.01"
              value={originalPriceRub}
              onChange={(event) => setOriginalPriceRub(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="baseDiscount">Стартовая скидка, %</label>
            <input
              id="baseDiscount"
              type="number"
              min={DISCOUNT_RULES.MIN_BASE_PERCENT}
              max={DISCOUNT_RULES.MAX_PERCENT}
              step="1"
              value={baseDiscountPercent}
              onChange={(event) => setBaseDiscountPercent(event.target.value)}
              required
            />
            <span className="field-hint">
              От {DISCOUNT_RULES.MIN_BASE_PERCENT}% до {DISCOUNT_RULES.MAX_PERCENT}% — дальше сама растёт к концу
              самовывоза.
            </span>
          </div>
        </div>

        {displayPrice !== null && netPayout !== null ? (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: -6 }}>
            Цена на витрине: <strong style={{ color: "var(--color-text)" }}>{displayPrice.toFixed(0)} ₽</strong>
            {" · "}
            {isInTrial(business) ? (
              <>
                ты получишь <strong style={{ color: "var(--color-primary)" }}>{netPayout.toFixed(0)} ₽</strong> — пробный
                период, комиссия не удерживается
              </>
            ) : (
              <>
                ты получишь <strong style={{ color: "var(--color-primary)" }}>{netPayout.toFixed(0)} ₽</strong> за
                вычетом комиссии платформы {business.commissionPercent}%
              </>
            )}
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="weight">Вес, кг</label>
          <input
            id="weight"
            type="number"
            min={0.01}
            step="0.01"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            required
          />
        </div>

        {!isEdit ? (
          <div className="field">
            <label htmlFor="quantity">Количество единиц</label>
            <input
              id="quantity"
              type="number"
              min={1}
              step="1"
              value={quantityTotal}
              onChange={(event) => setQuantityTotal(event.target.value)}
              required
            />
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="field">
            <label htmlFor="pickupStart">Начало самовывоза</label>
            <input
              id="pickupStart"
              type="datetime-local"
              value={pickupStart}
              onChange={(event) => setPickupStart(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="pickupEnd">Конец самовывоза</label>
            <input
              id="pickupEnd"
              type="datetime-local"
              value={pickupEnd}
              onChange={(event) => setPickupEnd(event.target.value)}
              required
            />
          </div>
        </div>

        {isEdit ? (
          <div className="field">
            <label htmlFor="status">Статус</label>
            <select id="status" value={status} onChange={(event) => setStatus(event.target.value as OfferStatus)}>
              <option value={OfferStatus.ACTIVE}>Активен</option>
              <option value={OfferStatus.ARCHIVED}>В архиве</option>
            </select>
          </div>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={saving || photoBusy} style={{ flex: 1 }}>
            {saving ? "Сохраняем..." : photoBusy ? "Загружаем фото..." : "Сохранить"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
