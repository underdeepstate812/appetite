import { useState, type FormEvent } from "react";
import { Zap } from "lucide-react";
import { DISCOUNT_RULES, OfferCategory, type Business } from "@apetite/shared";
import { offersApi } from "../api/offers";
import { ApiError } from "../api/client";
import { computeNetPayout, isInTrial } from "../utils/commission";

interface QuickOfferCreateProps {
  business: Business;
  onCreated: () => void;
}

/**
 * Самая частая рутина заведения — не полная форма (категория/описание/статус),
 * а 4 поля, которые меняются каждый день: название, цена, скидка, вес.
 * Остальное — сознательные дефолты (категория "Еда", 1 шт, самовывоз в
 * ближайшие 2 часа) — их всегда можно донастроить через "Изменить" в таблице.
 */
export function QuickOfferCreate({ business, onCreated }: QuickOfferCreateProps) {
  const [title, setTitle] = useState("");
  const [priceRub, setPriceRub] = useState("");
  const [discountPercent, setDiscountPercent] = useState(String(DISCOUNT_RULES.DEFAULT_BASE_PERCENT));
  const [weightKg, setWeightKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  // Цена на витрине (то, что платит покупатель) — из неё же считаем, сколько реально
  // упадёт на счёт заведения после удержания комиссии платформы (см. utils/commission.ts).
  const price = Number(priceRub);
  const discount = Number(discountPercent);
  const displayPrice = price > 0 && discount >= 0 ? Math.round(price * (1 - discount / 100) * 100) / 100 : null;
  const netPayout = displayPrice !== null ? computeNetPayout(displayPrice, business) : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const pickupEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      await offersApi.create({
        businessId: business.id,
        title,
        category: OfferCategory.FOOD,
        originalPriceRub: Number(priceRub),
        baseDiscountPercent: Number(discountPercent),
        weightKg: Number(weightKg),
        quantityTotal: 1,
        pickupStart: now.toISOString(),
        pickupEnd: pickupEnd.toISOString(),
      });
      setTitle("");
      setPriceRub("");
      setDiscountPercent(String(DISCOUNT_RULES.DEFAULT_BASE_PERCENT));
      setWeightKg("");
      setJustCreated(true);
      setTimeout(() => setJustCreated(false), 2500);
      onCreated();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Не удалось создать оффер");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="card" style={quickCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={iconChipStyle}>
          <Zap size={15} strokeWidth={2.2} color="var(--color-primary)" aria-hidden="true" />
        </span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>Быстрое создание</p>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 1 }}>
            Категория «Еда», 1 шт, самовывоз в ближайшие 2 часа — остальное поменяешь при необходимости
          </p>
        </div>
      </div>

      <div style={rowStyle}>
        <div className="field" style={{ flex: "2 1 200px" }}>
          <label htmlFor="quick-title">Название</label>
          <input
            id="quick-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Сет роллов дня"
            required
          />
        </div>
        <div className="field" style={{ flex: "1 1 110px" }}>
          <label htmlFor="quick-price">Цена, ₽</label>
          <input
            id="quick-price"
            type="number"
            min={1}
            step="0.01"
            value={priceRub}
            onChange={(event) => setPriceRub(event.target.value)}
            required
          />
        </div>
        <div className="field" style={{ flex: "1 1 110px" }}>
          <label htmlFor="quick-discount">Скидка, %</label>
          <input
            id="quick-discount"
            type="number"
            min={DISCOUNT_RULES.MIN_BASE_PERCENT}
            max={DISCOUNT_RULES.MAX_PERCENT}
            step="1"
            value={discountPercent}
            onChange={(event) => setDiscountPercent(event.target.value)}
            required
          />
        </div>
        <div className="field" style={{ flex: "1 1 100px" }}>
          <label htmlFor="quick-weight">Вес, кг</label>
          <input
            id="quick-weight"
            type="number"
            min={0.01}
            step="0.01"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving} style={{ flex: "0 0 auto", alignSelf: "flex-end" }}>
          {saving ? "Публикуем..." : justCreated ? "Готово ✓" : "Опубликовать"}
        </button>
      </div>

      {displayPrice !== null && netPayout !== null ? (
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Цена на витрине: <strong style={{ color: "var(--color-text)" }}>{displayPrice.toFixed(0)} ₽</strong>
          {" · "}
          {isInTrial(business) ? (
            <>
              Ты получишь <strong style={{ color: "var(--color-primary)" }}>{netPayout.toFixed(0)} ₽</strong> — пробный
              период, комиссия не удерживается
            </>
          ) : (
            <>
              Ты получишь <strong style={{ color: "var(--color-primary)" }}>{netPayout.toFixed(0)} ₽</strong> за вычетом
              комиссии платформы {business.commissionPercent}%
            </>
          )}
        </p>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

const quickCardStyle = {
  padding: "18px 20px",
  display: "flex",
  flexDirection: "column" as const,
  gap: 14,
  border: "1.5px solid var(--color-primary-soft)",
};

const rowStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap" as const,
  alignItems: "flex-end",
};

const iconChipStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "var(--color-primary-soft)",
  flexShrink: 0,
};
