import { memo, type CSSProperties } from "react";
import { Clock } from "lucide-react";
import { getOfferUrgencyRatio, getTimeLeft, heatColor, type NearbyOffer } from "@apetite/shared";
import { OfferPhoto } from "./OfferPhoto";
import { FireIcon } from "./FireIcon";
import { formatDistance, formatRub, formatTimeLeft } from "../utils/format";
import { isHotOffer } from "../utils/offers";

interface ShowcaseCardProps {
  offer: NearbyOffer;
  now: number;
  selected: boolean;
  onSelect: (offerId: string) => void;
  /** Копия для бесшовной петли ленты: вне порядка табуляции (в DOM она ещё и aria-hidden у родителя). */
  decorative?: boolean;
}

/**
 * Карточка ленты «Сейчас на витрине». Нажатие не уводит со страницы: предложение открывается на карте ниже
 * (карточка с кнопкой «Купить» и адресом) — человек сразу видит, где это.
 * Нижняя «полоска жара» — тот же сигнал, что цвет метки на карте: чем меньше времени, тем она длиннее и краснее.
 */
export const ShowcaseCard = memo(function ShowcaseCard({ offer, now, selected, onSelect, decorative = false }: ShowcaseCardProps) {
  const timeLeft = getTimeLeft(offer.pickupEnd, now);
  const ratio = getOfferUrgencyRatio(offer, now);
  const heat = heatColor(ratio, "light");
  const hot = isHotOffer(offer, now);
  const featured = !!offer.featured;
  const closed = timeLeft.isPast;

  return (
    <button
      type="button"
      className={`show-card${hot ? " is-hot" : ""}${featured ? " is-featured" : ""}${selected ? " is-selected" : ""}`}
      style={{ "--heat": heat, "--heat-fill": `${Math.round(Math.max(0.06, Math.min(1, ratio)) * 100)}%` } as CSSProperties}
      aria-pressed={selected}
      tabIndex={decorative ? -1 : undefined}
      aria-label={`${offer.title}, ${offer.businessName}, ${formatRub(offer.discountedPrice)}, скидка ${offer.discountPercent}%. Показать на карте`}
      onClick={() => onSelect(offer.id)}
    >
      <span className="show-card-media">
        <OfferPhoto offer={offer} className="show-card-photo" />
        <span className="show-card-discount" style={{ background: heat }}>
          −{offer.discountPercent}%
        </span>
        {hot ? (
          <span className="show-card-tag">
            <FireIcon size={12} /> {featured ? "Предложение дня" : "Горит"}
          </span>
        ) : null}
        <span className="show-card-time">
          <Clock size={12} strokeWidth={2.4} aria-hidden="true" />
          {closed ? "закрыто" : featured ? "до завтра" : formatTimeLeft(timeLeft.totalMinutes)}
        </span>
      </span>
      <span className="show-card-body">
        <span className="show-card-shop">
          {offer.businessName} · {formatDistance(offer.distanceKm)}
        </span>
        <span className="show-card-title">{offer.title}</span>
        <span className="show-card-price">
          <b>{formatRub(offer.discountedPrice)}</b>
          <s>{formatRub(offer.originalPrice)}</s>
        </span>
      </span>
      <span className="show-card-heat" aria-hidden="true" />
    </button>
  );
});
