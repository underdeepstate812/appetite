import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NearbyOffer } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";
import { CountdownBadge } from "./CountdownBadge";

interface OfferCardProps {
  offer: NearbyOffer;
  onPress: () => void;
}

export function OfferCard({ offer, onPress }: OfferCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[theme.typography.bodyBold, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
          {offer.title}
        </Text>
        <View style={[styles.badge, { backgroundColor: theme.colors.primary, borderRadius: theme.radii.full }]}>
          <Text style={styles.badgeText}>-{offer.discountPercent}%</Text>
        </View>
      </View>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
        {offer.businessName} · {offer.distanceKm.toFixed(1)} {t("common.km")}
      </Text>

      <View style={styles.footerRow}>
        <Text style={[theme.typography.bodyBold, { color: theme.colors.primary }]}>
          {(offer.discountedPrice / 100).toFixed(0)} ₽
        </Text>
        <Text style={[styles.originalPrice, { color: theme.colors.textMuted }]}>
          {(offer.originalPrice / 100).toFixed(0)} ₽
        </Text>
        <View style={styles.spacer} />
        <CountdownBadge pickupEnd={offer.pickupEnd} />
      </View>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
        {t("offerDetail.left", { count: offer.quantityLeft })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 10 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  badgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  footerRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  originalPrice: { fontSize: 13, textDecorationLine: "line-through" },
  spacer: { flex: 1 },
});
