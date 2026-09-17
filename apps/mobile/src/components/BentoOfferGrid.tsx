import React from "react";
import { StyleSheet, View } from "react-native";
import type { NearbyOffer } from "@apetite/shared";
import { OfferCard } from "./OfferCard";

/**
 * Bento-сетка вместо однородного вертикального списка: самый "горячий" оффер
 * (максимальная скидка / меньше всего времени) — на всю ширину хиро-тайлом,
 * остальные — в 2-колоночной сетке. Асимметрия — суть bento-паттерна, ровная
 * сетка 2x2 выглядела бы как typical dashboard, не как "живая" витрина.
 */
export function BentoOfferGrid({
  offers,
  onPressOffer,
}: {
  offers: NearbyOffer[];
  onPressOffer: (offer: NearbyOffer) => void;
}) {
  if (offers.length === 0) return null;

  const featured = offers.reduce((hottest, offer) => (offer.discountPercent > hottest.discountPercent ? offer : hottest));
  const rest = offers.filter((offer) => offer.id !== featured.id);

  return (
    <View>
      <View style={styles.featuredWrap}>
        <OfferCard offer={featured} onPress={() => onPressOffer(featured)} featured />
      </View>
      <View style={styles.grid}>
        {rest.map((offer) => (
          <View key={offer.id} style={styles.cell}>
            <OfferCard offer={offer} onPress={() => onPressOffer(offer)} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  featuredWrap: { marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  cell: { width: "48%", marginBottom: 12 },
});
