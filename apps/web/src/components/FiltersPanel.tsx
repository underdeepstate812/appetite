import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { NearbyOffer, OfferCategory } from "@apetite/shared";
import { CATEGORY_FILTERS } from "../utils/categories";
import { countByCategory, filterOffers, priceBounds, sanitizeCategory } from "../utils/offers";
import { MAX_PRICE_RUB, checkPriceRange, formatPriceRub, type PriceLimits } from "../utils/priceFilter";

/** Что применяется к витрине из панели (горящие — отдельный переключатель в шапке ленты, у него своё место). */
export interface FilterValues {
  category: OfferCategory | "all";
  minRub: number | null;
  maxRub: number | null;
}

/** Быстрые диапазоны: на телефоне набирать цифры долго, а три вилки покрывают почти все случаи. */
const PRESETS: Array<{ label: string; min: string; max: string }> = [
  { label: "до 300 ₽", min: "", max: "300" },
  { label: "300–700 ₽", min: "300", max: "700" },
  { label: "от 700 ₽", min: "700", max: "" },
];

/** Сколько фильтров из панели сейчас включено — для значка на кнопке. */
export function activeFilterCount(value: FilterValues): number {
  return (value.category !== "all" ? 1 : 0) + (value.minRub !== null || value.maxRub !== null ? 1 : 0);
}

interface FiltersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: FilterValues;
  onApply: (next: FilterValues) => void;
  /** Весь набор города ДО фильтров панели: по нему считаем «Показать N», счётчики категорий и подсказку по ценам. */
  offers: NearbyOffer[] | null;
  /** «Только горящие» из шапки ленты — учитывается в счётчиках, чтобы цифра на кнопке совпадала с лентой. */
  onlyHot: boolean;
  now: number;
  /** Движение ленты (WCAG 2.2.2: подвижное нужно уметь остановить). Переключатель есть, только если лента вообще движется. */
  drift: { available: boolean; playing: boolean; onToggle: () => void };
}

const textOf = (value: number | null) => (value === null ? "" : String(value));

/**
 * Фильтры витрины: круглая кнопка в углу ленты и всплывающая панель — категория и цена «от — до» с проверкой ввода.
 * Изменения копятся в черновике и применяются кнопкой «Показать N» (на ней живой счётчик); Esc, клик мимо и ✕ — закрыть
 * без применения. Не модальная: страница под ней не блокируется.
 */
export function FiltersPanel({ open, onOpenChange, value, onApply, offers, onlyHot, now, drift }: FiltersPanelProps) {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const minRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<FilterValues["category"]>(value.category);
  const [minText, setMinText] = useState(textOf(value.minRub));
  const [maxText, setMaxText] = useState(textOf(value.maxRub));
  const [touched, setTouched] = useState({ min: false, max: false });

  // Пока панель закрыта, черновик всегда равен применённым значениям: недописанный текст не «всплывёт» при следующем открытии
  // (раньше он на один кадр мелькал в полях, пока эффект открытия не успевал его заменить).
  useEffect(() => {
    if (open) return;
    setCategory(value.category);
    setMinText(textOf(value.minRub));
    setMaxText(textOf(value.maxRub));
    setTouched({ min: false, max: false });
  }, [open, value.category, value.minRub, value.maxRub]);

  useEffect(() => {
    if (open) minRef.current?.focus();
  }, [open]);

  const close = (restoreFocus: boolean) => {
    onOpenChange(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onOpenChange]);

  // Границы цены — по предложениям ВЫБРАННОЙ категории: у букетов и у кофе они разные, и «от 77 ₽» для цветов — такая же
  // ошибка, как «от 10 ₽» для всей витрины. Ниже минимума и выше максимума выбрать нельзя: там ничего нет.
  const categoryLabel = CATEGORY_FILTERS.find((filter) => filter.id === category)?.label;
  const scope = category === "all" ? "на витрине" : `в категории «${categoryLabel}»`;
  const bounds = useMemo(() => (offers ? priceBounds(offers.filter((offer) => category === "all" || offer.category === category)) : null), [offers, category]);
  const limits: PriceLimits | null = bounds ? { ...bounds, scope } : null;
  const check = useMemo(() => checkPriceRange(minText, maxText, bounds ? { ...bounds, scope } : null), [minText, maxText, bounds, scope]);
  const base = { minRub: check.valid ? check.min.value : null, maxRub: check.valid ? check.max.value : null, onlyHot };
  const counts = useMemo(() => (offers ? countByCategory(offers, base, now) : null), [offers, base.minRub, base.maxRub, onlyHot, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const matching = offers && check.valid ? filterOffers(offers, { ...base, category }, now).length : null;

  const active = activeFilterCount(value);
  const minError = touched.min || minText ? check.min.error ?? check.rangeError : null;
  const maxError = touched.max || maxText ? check.max.error : null;
  const canApply = check.valid && (matching === null || matching > 0);
  const presetOn = (preset: (typeof PRESETS)[number]) => minText === preset.min && maxText === preset.max;
  const dirty = category !== "all" || minText !== "" || maxText !== "";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched({ min: true, max: true });
    if (!canApply) return;
    onApply({ category, minRub: check.min.value, maxRub: check.max.value });
    close(true);
  };

  /** «Поставить 77 ₽» под ошибкой: исправить поле на ближайшую допустимую границу одним нажатием. */
  const fixField = (field: "min" | "max", value: number) => {
    (field === "min" ? setMinText : setMaxText)(String(value));
    setTouched((state) => ({ ...state, [field]: true }));
  };

  const reset = () => {
    setCategory("all");
    setMinText("");
    setMaxText("");
    setTouched({ min: false, max: false });
  };

  return (
    <div className="filters" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`filters-btn${active > 0 ? " is-active" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={active > 0 ? `Фильтры, включено: ${active}` : "Фильтры"}
        onClick={() => onOpenChange(!open)}
      >
        <SlidersHorizontal size={18} strokeWidth={2.3} aria-hidden="true" />
        {active > 0 ? (
          <span className="filters-badge" aria-hidden="true">
            {active}
          </span>
        ) : null}
      </button>

      {open ? (
        <form className="filters-panel" id={panelId} role="dialog" aria-label="Фильтры" aria-modal="false" onSubmit={submit} noValidate>
          <header className="filters-head">
            <h2>Фильтры</h2>
            <button type="button" className="filters-close" onClick={() => close(true)} aria-label="Закрыть фильтры">
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <fieldset className="filters-group">
            <legend>Категория</legend>
            <div className="filters-chips">
              {CATEGORY_FILTERS.map((filter) => {
                const n = counts?.[filter.id];
                // Категорию без предложений (при текущей цене) выбрать нельзя — выбранная остаётся доступной, чтобы её можно было снять.
                const empty = n === 0 && filter.id !== "all" && category !== filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    className={`filters-chip${category === filter.id ? " is-on" : ""}${empty ? " is-empty" : ""}`}
                    aria-pressed={category === filter.id}
                    disabled={empty}
                    title={empty ? "В этой категории сейчас нет предложений" : undefined}
                    onClick={() => setCategory(sanitizeCategory(filter.id))}
                  >
                    {filter.label}
                    {n !== undefined ? <span className="filters-chip-n">{n}</span> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="filters-group">
            <legend>Цена, ₽</legend>
            <div className="filters-price">
              <label className="filters-field">
                <span>От</span>
                <input
                  ref={minRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="done"
                  value={minText}
                  placeholder={bounds ? String(bounds.min) : "0"}
                  aria-invalid={minError ? true : undefined}
                  aria-describedby={minError ? `${uid}-min-err` : undefined}
                  onChange={(event) => setMinText(event.target.value)}
                  onBlur={() => setTouched((state) => ({ ...state, min: true }))}
                />
              </label>
              <span className="filters-dash" aria-hidden="true">
                —
              </span>
              <label className="filters-field">
                <span>До</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="done"
                  value={maxText}
                  placeholder={bounds ? String(bounds.max) : String(MAX_PRICE_RUB)}
                  aria-invalid={maxError || check.rangeError ? true : undefined}
                  aria-describedby={maxError ? `${uid}-max-err` : check.rangeError ? `${uid}-min-err` : undefined}
                  onChange={(event) => setMaxText(event.target.value)}
                  onBlur={() => setTouched((state) => ({ ...state, max: true }))}
                />
              </label>
            </div>
            <div className="filters-errors" aria-live="polite">
              {minError ? (
                <p className="filters-error" id={`${uid}-min-err`}>
                  {minError}
                  {check.min.fix !== null ? (
                    <button type="button" className="filters-fix" onClick={() => fixField("min", check.min.fix as number)}>
                      Поставить {formatPriceRub(check.min.fix)}
                    </button>
                  ) : null}
                </p>
              ) : null}
              {maxError ? (
                <p className="filters-error" id={`${uid}-max-err`}>
                  {maxError}
                  {check.max.fix !== null ? (
                    <button type="button" className="filters-fix" onClick={() => fixField("max", check.max.fix as number)}>
                      Поставить {formatPriceRub(check.max.fix)}
                    </button>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="filters-presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={`filters-chip is-small${presetOn(preset) ? " is-on" : ""}`}
                  aria-pressed={presetOn(preset)}
                  onClick={() => {
                    setMinText(preset.min);
                    setMaxText(preset.max);
                    setTouched({ min: false, max: false });
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {limits ? (
              <p className="filters-hint">
                {category === "all" ? "Сейчас на витрине" : `В категории «${categoryLabel}»`}: от {formatPriceRub(limits.min)} до {formatPriceRub(limits.max)}
              </p>
            ) : null}
          </fieldset>

          {drift.available ? (
            <div className="filters-switch-row">
              <span id={`${uid}-drift`}>Двигать ленту автоматически</span>
              <button type="button" role="switch" aria-checked={drift.playing} aria-labelledby={`${uid}-drift`} className={`filters-switch${drift.playing ? " is-on" : ""}`} onClick={drift.onToggle}>
                <span aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <footer className="filters-foot">
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={!dirty}>
              Сбросить
            </button>
            <button type="submit" className="btn btn-primary btn-sm filters-apply" disabled={!canApply}>
              {!check.valid ? "Исправьте цену" : matching === 0 ? "Ничего не найдено" : matching === null ? "Применить" : `Показать ${matching}`}
            </button>
          </footer>
        </form>
      ) : null}
    </div>
  );
}
