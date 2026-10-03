import React, { useMemo } from "react";
import type { NearbyOffer } from "@apetite/shared";
import { useNow } from "../hooks/useNow";
import { sortHotFirst } from "../utils/offers";
import { CardGrid } from "./CardGrid";
import { OfferCard } from "./OfferCard";
import { StaggerReveal } from "./StaggerReveal";

/**
 * Компактные карточки в сетке фиксированной ширины (CardGrid): на телефоне одна
 * колонка, на широком экране добавляются колонки, а не растягиваются карточки.
 * Прежняя bento-сетка с крупным хиро-тайлом занимала рядом с картой почти весь
 * экран, поэтому карточка остаётся компактной строкой. Порядок — сначала
 * горящие, внутри группы по убыванию скидки (см. sortHotFirst). Сортировка
 * пересчитывается по тикам useNow, поэтому оффер, который "загорелся", сам
 * поднимается наверх.
 */
export function OfferList({
  offers,
  onPressOffer,
}: {
  offers: NearbyOffer[];
  onPressOffer: (offer: NearbyOffer) => void;
}) {
  const now = useNow();
  const sorted = useMemo(() => sortHotFirst(offers, now), [offers, now]);

  return (
    <CardGrid>
      {sorted.map((offer, index) => (
        <StaggerReveal key={offer.id} index={index} fill>
          <OfferCard offer={offer} onPress={() => onPressOffer(offer)} />
        </StaggerReveal>
      ))}
    </CardGrid>
  );
}
