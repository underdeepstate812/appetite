import { CalendarClock, FlaskConical, TriangleAlert } from "lucide-react";
import { allergenNames, foodInfoStatus, formatBestBefore, type FoodOffer } from "../utils/foodInfo";

interface FoodInfoProps {
  offer: FoodOffer;
  /** compact — в узких местах (лист на карте, диалог): мельче и без лишних подсказок. */
  compact?: boolean;
}

/**
 * Состав, аллергены и срок годности — до оплаты (закон о защите прав потребителей). У старых офферов, где заведение
 * ничего не указало, не делаем вид, что аллергенов нет, а прямо просим уточнить у заведения. Для цветов блока нет.
 */
export function FoodInfo({ offer, compact = false }: FoodInfoProps) {
  const status = foodInfoStatus(offer);
  if (status === "none") return null;

  if (status === "missing") {
    return (
      <section className={`food-info is-missing${compact ? " is-compact" : ""}`} aria-label="Состав и срок годности">
        <p className="food-info-missing">
          <TriangleAlert size={16} aria-hidden="true" /> Заведение не указало состав и аллергены. Уточните у заведения до покупки.
        </p>
      </section>
    );
  }

  const names = allergenNames(offer.allergens);
  return (
    <section className={`food-info${compact ? " is-compact" : ""}`} aria-label="Состав и срок годности">
      <h3 className="food-info-title">
        <FlaskConical size={14} aria-hidden="true" /> Состав и срок годности
      </h3>
      <dl className="food-info-list">
        <div>
          <dt>Состав</dt>
          <dd>{offer.ingredients}</dd>
        </div>
        <div>
          <dt>Аллергены</dt>
          <dd>
            {names.length > 0 ? (
              <ul className="food-info-chips" aria-label={`Аллергены: ${names.join(", ")}`}>
                {names.map((name) => (
                  <li key={name} className="food-info-chip">
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              "Аллергенов нет — по данным заведения"
            )}
          </dd>
        </div>
        <div>
          <dt>
            <CalendarClock size={13} aria-hidden="true" /> Годен до
          </dt>
          <dd>{formatBestBefore(offer.bestBefore as string)}</dd>
        </div>
      </dl>
    </section>
  );
}
