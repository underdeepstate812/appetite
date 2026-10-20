import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { ALLERGEN_LABELS_RU, INGREDIENTS_MAX_LENGTH, OFFER_ALLERGENS, OfferCategory, isOfferAllergen, requiresFoodInfo } from "@apetite/shared";
import type { FoodInfoState } from "../utils/foodInfo";

/** Состав и аллергены из прежнего оффера заведения — заведения повторяют блюда, и вводить то же самое заново незачем. */
export interface FoodInfoSuggestion {
  title: string;
  ingredients: string;
  allergens: string[];
}

interface FoodInfoFieldsProps {
  idPrefix: string;
  category: OfferCategory;
  value: FoodInfoState;
  onChange: (next: FoodInfoState) => void;
  /** Конец самовывоза (datetime-local): срок годности не может быть раньше. */
  pickupEnd: string;
  /** Компактный вид для быстрого создания: подсказки короче. */
  compact?: boolean;
  suggestions?: FoodInfoSuggestion[];
}

const name = (code: string) => (isOfferAllergen(code) ? ALLERGEN_LABELS_RU[code] : code);

/** Итог на кнопке: «Выбрать» / «Аллергенов нет» / «Молоко и лактоза, Глютен (злаки) +1». */
function allergenSummary(value: FoodInfoState): string {
  if (value.noAllergens) return "Аллергенов нет";
  if (value.allergens.length === 0) return "Выбрать";
  const shown = value.allergens.slice(0, 2).map(name).join(", ");
  return value.allergens.length > 2 ? `${shown} +${value.allergens.length - 2}` : shown;
}

/**
 * «Состав и срок годности»: покупатель должен увидеть это до оплаты (закон о защите прав потребителей), поэтому для еды,
 * выпечки и продуктов всё здесь обязательно. Цветам блок не нужен — он не показывается.
 * Компактно: состав — одно поле (+ «подставить из прежних»), аллергены — раскрывающийся список вместо 14 крупных чипов,
 * «Годен до» — рядом в одной строке.
 */
export function FoodInfoFields({ idPrefix, category, value, onChange, pickupEnd, compact = false, suggestions = [] }: FoodInfoFieldsProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  if (!requiresFoodInfo(category)) return null;

  const toggleAllergen = (code: string) => {
    const allergens = value.allergens.includes(code) ? value.allergens.filter((item) => item !== code) : [...value.allergens, code];
    onChange({ ...value, allergens, noAllergens: false });
  };
  const pickSuggestion = (index: string) => {
    const found = suggestions[Number(index)];
    if (!found) return;
    onChange({ ...value, ingredients: found.ingredients, allergens: found.allergens, noAllergens: found.allergens.length === 0 });
  };

  return (
    <fieldset className="food-info" style={fieldsetStyle}>
      <legend style={legendStyle}>Состав и срок годности</legend>
      {!compact ? <p className="field-hint">Покупатель увидит это до оплаты — для еды, выпечки и продуктов поля обязательны.</p> : null}

      <div className="field">
        <div style={labelRowStyle}>
          <label htmlFor={`${idPrefix}-ingredients`}>Состав</label>
          {suggestions.length > 0 ? (
            <select aria-label="Подставить состав из прежнего предложения" value="" onChange={(event) => pickSuggestion(event.target.value)} style={suggestStyle}>
              <option value="">Подставить из прежних…</option>
              {suggestions.map((item, index) => (
                <option key={`${item.title}-${index}`} value={index}>
                  {item.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <textarea
          id={`${idPrefix}-ingredients`}
          value={value.ingredients}
          maxLength={INGREDIENTS_MAX_LENGTH}
          rows={2}
          placeholder="Тесто (пшеничная мука, вода), сыр моцарелла, томатный соус"
          onChange={(event) => onChange({ ...value, ingredients: event.target.value })}
          required
        />
      </div>

      <div style={rowStyle}>
        <div className="field" style={{ flex: "1 1 220px", position: "relative" }} ref={wrapRef}>
          <label id={`${idPrefix}-allergens-label`}>Аллергены</label>
          <button
            ref={buttonRef}
            type="button"
            id={`${idPrefix}-allergens`}
            className="allergen-trigger"
            aria-haspopup="true"
            aria-expanded={open}
            aria-controls={`${idPrefix}-allergens-panel`}
            aria-labelledby={`${idPrefix}-allergens-label ${idPrefix}-allergens`}
            onClick={() => setOpen((v) => !v)}
            style={triggerStyle(value.noAllergens || value.allergens.length > 0)}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{allergenSummary(value)}</span>
            <ChevronDown size={16} aria-hidden="true" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {open ? (
            <div id={`${idPrefix}-allergens-panel`} role="group" aria-labelledby={`${idPrefix}-allergens-label`} style={panelStyle}>
              <label style={{ ...optionStyle(value.noAllergens), gridColumn: "1 / -1", fontWeight: 700 }}>
                <input type="checkbox" checked={value.noAllergens} onChange={(event) => onChange({ ...value, noAllergens: event.target.checked, allergens: event.target.checked ? [] : value.allergens })} style={checkStyle} />
                Аллергенов нет
              </label>
              {OFFER_ALLERGENS.map((code) => (
                <label key={code} style={optionStyle(value.allergens.includes(code))}>
                  <input type="checkbox" checked={value.allergens.includes(code)} onChange={() => toggleAllergen(code)} style={checkStyle} />
                  {ALLERGEN_LABELS_RU[code]}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="field" style={{ flex: "1 1 190px" }}>
          <label htmlFor={`${idPrefix}-best-before`}>Годен до</label>
          <input id={`${idPrefix}-best-before`} type="datetime-local" value={value.bestBefore} min={pickupEnd} onChange={(event) => onChange({ ...value, bestBefore: event.target.value })} required />
        </div>
      </div>

      {value.allergens.length > 0 && !value.noAllergens ? (
        <ul style={chipsStyle} aria-label="Выбранные аллергены">
          {value.allergens.map((code) => (
            <li key={code} style={chipStyle}>
              {name(code)}
              <button type="button" aria-label={`Убрать: ${name(code)}`} onClick={() => toggleAllergen(code)} style={chipRemoveStyle}>
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!compact ? <span className="field-hint">«Годен до» — не раньше конца самовывоза.</span> : null}
    </fieldset>
  );
}

const fieldsetStyle = { border: "1px solid var(--color-border)", borderRadius: 12, padding: "10px 14px 12px", display: "flex", flexDirection: "column" as const, gap: 10, minInlineSize: 0 };
const legendStyle = { fontSize: 13, fontWeight: 700, padding: "0 6px", color: "var(--color-text)" };
const labelRowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" as const };
const suggestStyle = { fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", maxWidth: 220, width: "auto" };
const rowStyle = { display: "flex", gap: 12, flexWrap: "wrap" as const, alignItems: "flex-start" };
const triggerStyle = (filled: boolean) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  width: "100%",
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 10,
  border: `1.5px solid ${filled ? "var(--color-primary)" : "var(--color-border)"}`,
  background: filled ? "var(--color-primary-soft)" : "var(--color-surface)",
  color: filled ? "var(--color-text)" : "var(--color-text-muted)",
  fontSize: 14,
  cursor: "pointer",
  textAlign: "left" as const,
});
const panelStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 4, marginTop: 6, padding: 8, border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-surface)", maxHeight: 340, overflowY: "auto" as const };
const optionStyle = (selected: boolean) => ({ display: "flex", alignItems: "center", gap: 8, minHeight: 36, padding: "4px 8px", borderRadius: 8, fontSize: 13.5, cursor: "pointer", background: selected ? "var(--color-primary-soft)" : "transparent" });
const checkStyle = { width: 16, height: 16, padding: 0, margin: 0, flexShrink: 0, accentColor: "var(--color-primary)" };
const chipsStyle = { display: "flex", flexWrap: "wrap" as const, gap: 6, margin: 0, padding: 0, listStyle: "none" };
const chipStyle = { display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 4px 3px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: "var(--color-primary-soft)", color: "var(--color-primary)" };
const chipRemoveStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, padding: 0, border: "none", borderRadius: "50%", background: "transparent", color: "inherit", cursor: "pointer" };
