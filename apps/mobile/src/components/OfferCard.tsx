import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { UtensilsCrossed, Croissant, Flower2, ShoppingBasket, Flame } from "lucide-react-native";
import { OfferCategory, type NearbyOffer } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";
import { useNow } from "../hooks/useNow";
import { getTimeLeft, getUrgencyRatio } from "../utils/time";
import { CountdownBadge } from "./CountdownBadge";

const CATEGORY_ICON = {
  [OfferCategory.FOOD]: UtensilsCrossed,
  [OfferCategory.BAKERY]: Croissant,
  [OfferCategory.FLOWERS]: Flower2,
  [OfferCategory.GROCERIES]: ShoppingBasket,
} as const;

interface OfferCardProps {
  offer: NearbyOffer;
  onPress: () => void;
  /** Bento-хиро тайл — на всю ширину, с эмоциональным ярлыком "успей забрать". */
  featured?: boolean;
}

export function OfferCard({ offer, onPress, featured = false }: OfferCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow();
  const ratio = getUrgencyRatio(getTimeLeft(offer.pickupEnd, now));

  const anim = useRef(new Animated.Value(ratio)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: ratio, duration: 1400, useNativeDriver: false }).start();
  }, [ratio, anim]);

  // "Тающая" рамка карточки — тот же непрерывный urgency-ratio, что и у CountdownBadge,
  // но выражен через цвет/толщину границы: чем ближе конец окна самовывоза, тем
  // теплее и плотнее контур (см. бриф: "Dissolving Borders").
  const borderColor = anim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [theme.colors.border, theme.colors.warning, theme.colors.danger],
  });
  const borderWidth = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });

  const Icon = CATEGORY_ICON[offer.category];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pressWrap, { opacity: pressed ? 0.88 : 1 }]}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surfaceElevated,
            borderRadius: theme.radii.lg,
            borderColor,
            borderWidth,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={[styles.iconChip, { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.md }]}>
            <Icon size={18} color={theme.colors.primary} strokeWidth={2} />
          </View>
          <View style={[styles.discountBadge, { backgroundColor: theme.colors.primary, borderRadius: theme.radii.full }]}>
            <Text style={styles.discountText}>-{offer.discountPercent}%</Text>
          </View>
        </View>

        {featured ? (
          // Красный, не primary — "успей забрать" это urgency-сигнал (тот же
          // смысловой регистр, что и тающий таймер/рамка), а не брендовый
          // акцент. Тот же принцип, что и у Deliveroo: brand-цвет и
          // "горячо/спешка"-цвет нарочно разведены, чтобы их нельзя было
          // спутать на витрине из карточек.
          <View style={styles.featuredEyebrow}>
            <Flame size={14} color={theme.colors.danger} strokeWidth={2.5} />
            <Text style={[styles.featuredEyebrowText, { color: theme.colors.danger }]}>
              {t("home.featuredEyebrow")}
            </Text>
          </View>
        ) : null}

        <Text
          style={[
            featured ? theme.typography.h3 : theme.typography.bodyBold,
            { color: theme.colors.text, marginTop: featured ? 6 : 10 },
          ]}
          numberOfLines={2}
        >
          {offer.title}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {offer.businessName} · {offer.distanceKm.toFixed(1)} {t("common.km")}
        </Text>

        <View style={styles.priceRow}>
          <Text style={[theme.typography.bodyBold, { color: theme.colors.primary }]}>
            {(offer.discountedPrice / 100).toFixed(0)} ₽
          </Text>
          <Text style={[styles.originalPrice, { color: theme.colors.textMuted }]}>
            {(offer.originalPrice / 100).toFixed(0)} ₽
          </Text>
        </View>

        <View style={styles.footerRow}>
          <CountdownBadge pickupEnd={offer.pickupEnd} />
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {t("offerDetail.left", { count: offer.quantityLeft })}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressWrap: { width: "100%" },
  card: { padding: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconChip: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  discountBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  discountText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  featuredEyebrow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  featuredEyebrowText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10 },
  originalPrice: { fontSize: 13, textDecorationLine: "line-through" },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
});
