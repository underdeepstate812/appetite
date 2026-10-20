import { useMemo, useState, type FormEvent } from "react";
import { DISCOUNT_RULES, DiscountMode, OfferCategory, SCHEDULE_RULES, requiresFoodInfo, scheduleHoursProblem, validateScheduleTiming, type Business, type OfferSchedule } from "@apetite/shared";
import { Modal } from "./Modal";
import { OfferPhotoField } from "./OfferPhotoField";
import { FoodInfoFields } from "./FoodInfoFields";
import { DiscountModeFields } from "./DiscountModeFields";
import { DayChips } from "./DayChips";
import { offerSchedulesApi } from "../api/offerSchedules";
import { ApiError } from "../api/client";
import { CATEGORY_LABELS } from "../constants";
import { toLocalInput, type FoodInfoState } from "../utils/foodInfo";
import { LEAD_OPTIONS, browserTimeZone, hoursBetween } from "../utils/schedule";

interface ScheduleFormModalProps {
  business: Business;
  schedule: OfferSchedule;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Опорный «конец самовывоза» для срока годности: у шаблона срок — не дата, а «конец самовывоза + N часов». Чтобы переиспользовать
 * блок «Состав и срок годности» (поле «Годен до» — datetime), показываем срок относительно условного конца сегодня в нужное время;
 * при сохранении снова превращаем в часы.
 */
function referenceEnd(endTime: string): string {
  const [h, m] = endTime.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return toLocalInput(date);
}

function foodStateOf(schedule: OfferSchedule): FoodInfoState {
  const reference = referenceEnd(schedule.pickupEndTime);
  const allergens = schedule.allergens ?? [];
  return {
    ingredients: schedule.ingredients ?? "",
    allergens,
    noAllergens: !!schedule.allergensDeclared && allergens.length === 0,
    bestBefore: toLocalInput(new Date(new Date(reference).getTime() + (schedule.bestBeforeHoursAfterEnd ?? 4) * 3_600_000)),
  };
}

/** Редактирование шаблона автовыкладки. Изменения действуют на будущие выкладки; уже выложенные офферы не трогаем. */
export function ScheduleFormModal({ business, schedule, onClose, onSaved }: ScheduleFormModalProps) {
  const [title, setTitle] = useState(schedule.title);
  const [description, setDescription] = useState(schedule.description ?? "");
  const [category, setCategory] = useState<OfferCategory>(schedule.category);
  const [price, setPrice] = useState(String(schedule.originalPrice / 100));
  const [discount, setDiscount] = useState(String(schedule.baseDiscountPercent));
  const [mode, setMode] = useState<DiscountMode>(schedule.discountMode);
  const [weightKg, setWeightKg] = useState(String(schedule.weightKg));
  const [quantity, setQuantity] = useState(String(schedule.quantityTotal));
  const [days, setDays] = useState<number[]>(schedule.daysOfWeek);
  const [startTime, setStartTime] = useState(schedule.pickupStartTime);
  const [endTime, setEndTime] = useState(schedule.pickupEndTime);
  const [lead, setLead] = useState(schedule.publishLeadMinutes);
  const [startsOn, setStartsOn] = useState(schedule.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(schedule.endsOn ?? "");
  const [active, setActive] = useState(schedule.isActive);
  const [imageUrl, setImageUrl] = useState<string | null>(schedule.imageUrl ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [food, setFood] = useState<FoodInfoState>(() => foodStateOf(schedule));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reference = useMemo(() => referenceEnd(endTime), [endTime]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const timing = { daysOfWeek: days, pickupStartTime: startTime, pickupEndTime: endTime, publishLeadMinutes: lead, timezone: schedule.timezone || browserTimeZone(), startsOn: startsOn || null, endsOn: endsOn || null };
    const problem = validateScheduleTiming(timing);
    if (problem) return setError(problem);
    if (business.workingHours) {
      if (timing.timezone !== business.timezone) return setError(`Время шаблона — по часовому поясу заведения (${business.timezone}), а на этом устройстве — ${timing.timezone}`);
      const hoursProblem = scheduleHoursProblem(business.workingHours, timing);
      if (hoursProblem) return setError(hoursProblem);
    }
    if (requiresFoodInfo(category)) {
      if (food.ingredients.trim().length < 3) return setError("Укажи состав: покупатель должен видеть его до оплаты");
      if (!food.noAllergens && food.allergens.length === 0) return setError("Отметь аллергены или выбери «Аллергенов нет»");
      if (!food.bestBefore || new Date(food.bestBefore).getTime() < new Date(reference).getTime()) return setError("Срок годности не может быть раньше конца самовывоза");
    }
    setSaving(true);
    setError(null);
    try {
      await offerSchedulesApi.update(schedule.id, {
        title,
        description: description || undefined,
        category,
        originalPriceRub: Number(price),
        baseDiscountPercent: Number(discount),
        discountMode: mode,
        weightKg: Number(weightKg),
        quantityTotal: Number(quantity),
        ...(imageUrl !== (schedule.imageUrl ?? null) ? { imageUrl } : {}),
        ...(requiresFoodInfo(category)
          ? { ingredients: food.ingredients.trim(), allergens: food.noAllergens ? [] : food.allergens, bestBeforeHoursAfterEnd: hoursBetween(reference, food.bestBefore) }
          : {}),
        ...timing,
        isActive: active,
      });
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Не удалось сохранить шаблон");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Шаблон автовыкладки" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)} className="stack" style={{ gap: 14 }}>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Изменения действуют на следующие выкладки. Уже выложенные офферы остаются как есть — их правят отдельно.</p>

        <div className="field">
          <label htmlFor="sch-title">Название</label>
          <input id="sch-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div className="field">
          <label id="sch-photo-label">Фото</label>
          <OfferPhotoField labelledBy="sch-photo-label" value={imageUrl} onChange={setImageUrl} category={category} title={title} onBusyChange={setPhotoBusy} />
        </div>
        <div className="field">
          <label htmlFor="sch-description">Описание (необязательно)</label>
          <textarea id="sch-description" value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sch-category">Категория</label>
          <select id="sch-category" value={category} onChange={(event) => setCategory(event.target.value as OfferCategory)}>
            {Object.values(OfferCategory).map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="field">
            <label htmlFor="sch-price">Цена без скидки, ₽</label>
            <input id="sch-price" type="number" min={1} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="sch-discount">{mode === DiscountMode.FIXED ? "Скидка, %" : "Стартовая скидка, %"}</label>
            <input id="sch-discount" type="number" min={DISCOUNT_RULES.MIN_BASE_PERCENT} max={DISCOUNT_RULES.MAX_PERCENT} step="1" value={discount} onChange={(event) => setDiscount(event.target.value)} required />
          </div>
        </div>
        <DiscountModeFields idPrefix="sch" mode={mode} onChange={setMode} baseDiscountPercent={Number(discount)} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="field">
            <label htmlFor="sch-weight">Вес, кг</label>
            <input id="sch-weight" type="number" min={0.01} step="0.01" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="sch-qty">Количество в каждой выкладке</label>
            <input id="sch-qty" type="number" min={1} max={1000} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          </div>
        </div>

        <DayChips idPrefix="sch" value={days} onChange={setDays} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="field">
            <label htmlFor="sch-start">Самовывоз с</label>
            <input id="sch-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="sch-end">до</label>
            <input id="sch-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="sch-lead">На витрине</label>
            <select id="sch-lead" value={lead} onChange={(event) => setLead(Number(event.target.value))}>
              {LEAD_OPTIONS.map((option) => (
                <option key={option.minutes} value={option.minutes}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <span className="field-hint" style={{ marginTop: -6 }}>
          Время — по часовому поясу {schedule.timezone}. Если «до» не позже «с» — самовывоз заканчивается на следующие сутки (окно от {SCHEDULE_RULES.MIN_WINDOW_MINUTES} минут до {SCHEDULE_RULES.MAX_WINDOW_HOURS} часов).
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="field">
            <label htmlFor="sch-from">Действует с (необязательно)</label>
            <input id="sch-from" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sch-to">Действует до (необязательно)</label>
            <input id="sch-to" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
          </div>
        </div>

        <FoodInfoFields idPrefix="sch" category={category} value={food} onChange={setFood} pickupEnd={reference} />
        {requiresFoodInfo(category) ? (
          <span className="field-hint" style={{ marginTop: -8 }}>
            Для шаблона «Годен до» считается от конца самовывоза каждого дня: сейчас +{hoursBetween(reference, food.bestBefore || reference)} ч.
          </span>
        ) : null}

        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} style={{ width: 16, height: 16, margin: 0, padding: 0, accentColor: "var(--color-primary)" }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Шаблон включён</span>
          <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>— выключите, чтобы поставить на паузу ({business.name})</span>
        </label>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={saving || photoBusy} style={{ flex: 1 }}>
            {saving ? "Сохраняем..." : photoBusy ? "Загружаем фото..." : "Сохранить шаблон"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
