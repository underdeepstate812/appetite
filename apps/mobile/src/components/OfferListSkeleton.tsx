import React from "react";
import { CardGrid } from "./CardGrid";
import { OfferSkeletonCard } from "./OfferSkeletonCard";

/** Форма загрузки повторяет OfferList — та же сетка, два ряда, ничего не перестраивается, когда приходят данные. */
export function OfferListSkeleton() {
  return (
    <CardGrid>
      {(columns) => Array.from({ length: Math.min(columns * 2, 8) }, (_, key) => <OfferSkeletonCard key={key} />)}
    </CardGrid>
  );
}
