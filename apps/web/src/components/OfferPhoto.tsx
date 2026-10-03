import { useState } from "react";
import type { Offer } from "@apetite/shared";
import { resolveAssetUrl } from "../api/client";
import { CATEGORY_META } from "../utils/categories";

interface OfferPhotoProps {
  offer: Pick<Offer, "imageUrl" | "category" | "title">;
  className?: string;
}

/**
 * Фото оффера, а при его отсутствии (или битой ссылке) — плашка категории с иконкой, как в ленте на
 * лендинге: честнее, чем подставлять чужую картинку.
 */
export function OfferPhoto({ offer, className = "" }: OfferPhotoProps) {
  const [failed, setFailed] = useState(false);
  const src = resolveAssetUrl(offer.imageUrl);
  const Icon = CATEGORY_META[offer.category].icon;

  if (src && !failed) {
    return (
      <div className={`offer-photo ${className}`}>
        <img src={src} alt={offer.title} loading="lazy" onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className={`offer-photo offer-photo-plate ${className}`} role="img" aria-label={offer.title}>
      <Icon size={34} strokeWidth={1.6} aria-hidden="true" />
    </div>
  );
}
