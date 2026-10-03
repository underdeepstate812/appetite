import { Link } from "react-router-dom";
import { ArrowRight, Clock, MapPin, Store, X } from "lucide-react";
import { getTimeLeft, getUrgencyRatio, heatColor, heatInk, type NearbyOffer } from "@apetite/shared";
import { OfferPhoto } from "./OfferPhoto";
import { FireIcon } from "./FireIcon";
import { useAuth } from "../store/auth";
import { useNow } from "../hooks/useNow";
import { CATEGORY_META } from "../utils/categories";
import { formatClock, formatDistance, formatRub, formatTimeLeft } from "../utils/format";
import { isHotOffer } from "../utils/offers";

interface OfferSheetProps {
  offer: NearbyOffer;
  onClose: () => void;
}

/**
 * Карточка оффера поверх карты (на десктопе — слева внизу, на телефоне — шторка снизу). Покупка начинается
 * прямо отсюда: «Купить» ведёт на оформление, а гостя оформление само отправит на вход и вернёт обратно.
 */
export function OfferSheet({ offer, onClose }: OfferSheetProps) {
  const { user } = useAuth();
  const now = useNow(30000);
  const timeLeft = getTimeLeft(offer.pickupEnd, now);
  const ratio = getUrgencyRatio(timeLeft);
  const hot = isHotOffer(offer, now);
  const soldOut = offer.quantityLeft <= 0;
  const closed = timeLeft.isPast;
  const unavailable = soldOut || closed;
  const meta = CATEGORY_META[offer.category];
  const CategoryIcon = meta.icon;
  const timeInk = heatInk(ratio, "light", "#12100d");

  return (
    <aside className="offer-sheet" aria-label={`Предложение: ${offer.title}`}>
      <button type="button" className="offer-sheet-close" onClick={onClose} aria-label="Закрыть карточку">
        <X size={18} aria-hidden="true" />
      </button>

      <div className="offer-sheet-media">
        <OfferPhoto offer={offer} />
        <span className="offer-sheet-discount" style={{ background: heatColor(ratio, "light") }}>
          −{offer.discountPercent}%
        </span>
        {hot ? (
          <span className="offer-sheet-hot">
            <FireIcon size={12} /> Горит
          </span>
        ) : null}
      </div>

      <div className="offer-sheet-body">
        <p className="offer-sheet-shop">
          <Store size={14} aria-hidden="true" /> {offer.businessName}
          <span className="offer-sheet-cat">
            <CategoryIcon size={13} aria-hidden="true" /> {meta.label}
          </span>
        </p>
        <h2 className="offer-sheet-title">{offer.title}</h2>
        {offer.description ? <p className="offer-sheet-desc">{offer.description}</p> : null}

        <dl className="offer-sheet-facts">
          <div>
            <dt>
              <MapPin size={14} aria-hidden="true" /> Адрес
            </dt>
            <dd>
              {offer.businessAddress} · {formatDistance(offer.distanceKm)}
            </dd>
          </div>
          <div>
            <dt>
              <Clock size={14} aria-hidden="true" /> Самовывоз
            </dt>
            <dd>
              {formatClock(offer.pickupStart)}–{formatClock(offer.pickupEnd)}
              <span className="offer-sheet-left" style={{ color: timeInk }}>
                {closed ? " · окно закрыто" : ` · ещё ${formatTimeLeft(timeLeft.totalMinutes)}`}
              </span>
            </dd>
          </div>
        </dl>

        <div className="offer-sheet-buy">
          <div>
            <p className="offer-sheet-price">
              {formatRub(offer.discountedPrice)} <s>{formatRub(offer.originalPrice)}</s>
            </p>
            <p className={`offer-sheet-stock${offer.quantityLeft <= 3 && !soldOut ? " is-low" : ""}`}>
              {soldOut ? "Раскупили" : `Осталось: ${offer.quantityLeft}`}
            </p>
          </div>
          {unavailable ? (
            <button type="button" className="btn btn-primary" disabled>
              {soldOut ? "Раскупили" : "Время вышло"}
            </button>
          ) : (
            <Link to={`/checkout/${offer.id}`} className="btn btn-primary">
              {user ? "Купить" : "Войти и купить"}
              <ArrowRight size={16} strokeWidth={2.4} className="btn-arrow" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
