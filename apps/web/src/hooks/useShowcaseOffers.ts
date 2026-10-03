import { useEffect, useState } from "react";
import { OfferCategory, getTimeLeft, type NearbyOffer } from "@apetite/shared";
import { sortHotFirst } from "../utils/offers";
import { offersApi } from "../api/offers";
import { resolveAssetUrl } from "../api/client";
import { SPB_CENTER } from "./useGeolocation";
import { formatDistance, formatPickupEnd } from "../utils/format";

export type ShowcaseCategory = "food" | "bakery" | "flowers" | "groceries";

/** Плитка ленты. Реальные офферы несут offerId (по нему заказывают); статичные демо-плитки — без него. */
export interface RibbonOffer {
  id: string;
  /** id настоящего оффера в API; undefined — демо-плитка, заказать нельзя. */
  offerId?: string;
  category: ShowcaseCategory;
  shop: string;
  title: string;
  oldPrice: number;
  price: number;
  /** Цена в копейках — для диалога согласия и кнопки заказа. */
  priceMinor?: number;
  discount: number;
  distance: string;
  pickup: string;
  /** Минут до конца окна самовывоза на момент загрузки — тикает вживую. */
  minutesLeft: number;
  image?: string;
  quantityLeft?: number;
  /** «Горячее предложение дня» — горит всегда и стоит в ленте первым. */
  featured?: boolean;
}

const CATEGORY_KEY: Record<OfferCategory, ShowcaseCategory> = {
  [OfferCategory.FOOD]: "food",
  [OfferCategory.BAKERY]: "bakery",
  [OfferCategory.FLOWERS]: "flowers",
  [OfferCategory.GROCERIES]: "groceries",
};

/** Витрина — ближайшие к центру города: на главной не просим геолокацию, лента нужна и гостю. */
const SHOWCASE_RADIUS_KM = 25;
const MAX_TILES = 30;

export function toRibbonOffer(offer: NearbyOffer, now: number = Date.now()): RibbonOffer {
  const timeLeft = getTimeLeft(offer.pickupEnd, now);
  return {
    id: offer.id,
    offerId: offer.id,
    category: CATEGORY_KEY[offer.category],
    shop: offer.businessName,
    title: offer.title,
    oldPrice: Math.round(offer.originalPrice / 100),
    price: Math.round(offer.discountedPrice / 100),
    priceMinor: offer.discountedPrice,
    discount: offer.discountPercent,
    distance: formatDistance(offer.distanceKm),
    pickup: formatPickupEnd(offer.pickupEnd, now),
    minutesLeft: timeLeft.totalMinutes,
    image: resolveAssetUrl(offer.imageUrl) ?? undefined,
    quantityLeft: offer.quantityLeft,
    featured: offer.featured,
  };
}

/**
 * Реальные офферы для ленты. null — пока грузим или если API недоступен/пуст: лента тогда показывает
 * статичные демо-плитки, а не пустоту (сайт не должен выглядеть сломанным, если backend лёг).
 */
export function useShowcaseOffers(refreshKey: number = 0): RibbonOffer[] | null {
  const [offers, setOffers] = useState<RibbonOffer[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    offersApi
      .nearby({ lat: SPB_CENTER.lat, lng: SPB_CENTER.lng, radiusKm: SHOWCASE_RADIUS_KM })
      .then((data) => {
        if (cancelled) return;
        // По городу офферов десятки, а плиток в ленте ограниченное число — берём самые горячие (предложение дня первым).
        const live = sortHotFirst(data.filter((o) => o.quantityLeft > 0 && !getTimeLeft(o.pickupEnd).isPast)).slice(0, MAX_TILES);
        setOffers(live.length > 0 ? live.map((o) => toRibbonOffer(o)) : null);
      })
      .catch(() => {
        // Ошибка обновления не должна стирать уже показанную витрину; до первой удачной загрузки и так null.
        if (!cancelled) setOffers((previous) => previous);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return offers;
}
