import React from "react";
import { StyleSheet, View } from "react-native";
import { OfferSkeletonCard } from "./OfferSkeletonCard";

/** Форма загрузки повторяет BentoOfferGrid (1 хиро-тайл + 2х2 сетка) — не мигает-перестраивается, когда приходят реальные данные. */
export function BentoOfferGridSkeleton() {
  return (
    <View>
      <View style={styles.featuredWrap}>
        <OfferSkeletonCard />
      </View>
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((key) => (
          <View key={key} style={styles.cell}>
            <OfferSkeletonCard />
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
