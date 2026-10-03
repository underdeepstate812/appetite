import { getOfferUrgencyRatio, getTimeLeft, heatColor, heatInk, type NearbyOffer } from "@apetite/shared";
import { OfferPhoto } from "./OfferPhoto";
import { FireIcon } from "./FireIcon";
import { formatDistance, formatRub, formatTimeLeft } from "../utils/format";
import { isHotOffer } from "../utils/offers";

interface OfferRowProps {
  offer: NearbyOffer;
  selected: boolean;
  now: number;
  onSelect: () => void;
}

export function OfferRow({ offer, selected, now, onSelect }: OfferRowProps) {
  const timeLeft = getTimeLeft(offer.pickupEnd, now);
  const ratio = getOfferUrgencyRatio(offer, now);
  const hot = isHotOffer(offer, now);

  return (
    <button
      type="button"
      className={`offer-row${selected ? " is-selected" : ""}${hot ? " is-hot" : ""}${offer.featured ? " is-featured" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <OfferPhoto offer={offer} className="offer-row-photo" />
      <span className="offer-row-main">
        {offer.featured ? (
          <span className="offer-row-promo">
            <FireIcon size={11} /> Предложение дня · 24 часа
          </span>
        ) : null}
        <span className="offer-row-shop">
          {offer.businessName} · {formatDistance(offer.distanceKm)}
        </span>
        <span className="offer-row-title">{offer.title}</span>
        <span className="offer-row-meta">
          <span className="offer-row-price">{formatRub(offer.discountedPrice)}</span>
          <s>{formatRub(offer.originalPrice)}</s>
          <span className="offer-row-time" style={{ color: heatInk(ratio, "light", "#12100d") }}>
            {hot ? <FireIcon size={11} /> : null}
            {timeLeft.isPast ? "закрыто" : formatTimeLeft(timeLeft.totalMinutes)}
          </span>
        </span>
      </span>
      <span className="offer-row-badge" style={{ background: heatColor(ratio, "light") }}>
        −{offer.discountPercent}%
      </span>
    </button>
  );
}
