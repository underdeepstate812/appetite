import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import type { NearbyOffer } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";
import { heatColor } from "../theme/heat";
import { contour, hashString } from "../utils/contour";
import { resolveAssetUrl } from "../api/client";
import { useUniqueId } from "../hooks/useUniqueId";
import { CATEGORY_ICON } from "./offer/categoryIcon";
import { DiscountStamp } from "./DiscountStamp";

interface OfferThumbProps {
  offer: NearbyOffer;
  /** Сторона квадрата, px. */
  size?: number;
  /** Жар окна (0..1): красит наклейку скидки и «тёплое пятно» у горящих. */
  ratio: number;
  hot: boolean;
  closed: boolean;
}

/**
 * Миниатюра предложения: фото (или иконка категории на изолиниях — у каждого предложения свой рисунок, фаза из id),
 * кружок с логотипом заведения и наклейка скидки, «приклеенная» к углу поверх. Общая для карточки списка и компактной
 * карточки на карте — один образ предложения в обоих местах.
 */
export function OfferThumb({ offer, size = 72, ratio, hot, closed }: OfferThumbProps) {
  const theme = useTheme();
  const dark = theme.mode === "dark";
  const washId = useUniqueId("thumbWash");
  const accent = hot ? theme.colors.ember : theme.colors.primary;
  const phase = hashString(offer.id) * Math.PI * 2;
  const glowColor = heatColor(ratio, theme.mode);
  const Icon = CATEGORY_ICON[offer.category];
  const scale = size / 72;

  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.clip, { width: size, height: size, borderRadius: 12 * scale + 2, backgroundColor: theme.colors.primarySoft }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={washId} cx="0" cy="0" r={size * 1.25} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={glowColor} stopOpacity={hot ? (dark ? 0.32 : 0.22) : 0} />
              <Stop offset="1" stopColor={glowColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={size} height={size} fill={`url(#${washId})`} />
          {[16, 27, 38].map((radius, index) => (
            <Path
              key={radius}
              d={contour(size * 0.62, size * 0.56, radius * scale, phase + index * 0.7, 0.85)}
              fill="none"
              stroke={accent}
              strokeOpacity={0.36 - index * 0.11}
              strokeWidth={1.2}
            />
          ))}
        </Svg>
        {offer.imageUrl ? (
          <Image source={{ uri: resolveAssetUrl(offer.imageUrl) ?? undefined }} style={styles.image} resizeMode="cover" />
        ) : (
          <Icon size={26 * scale} color={accent} strokeWidth={1.7} />
        )}
        <View style={[styles.logo, { backgroundColor: theme.colors.surfaceElevated }]}>
          {offer.businessLogoUrl ? (
            <Image source={{ uri: offer.businessLogoUrl }} style={styles.logoImage} />
          ) : (
            <Text style={[styles.logoInitial, { color: accent }]}>{offer.businessName.charAt(0)}</Text>
          )}
        </View>
      </View>
      <View style={styles.stamp} pointerEvents="none">
        <DiscountStamp percent={offer.discountPercent} ratio={closed ? 0 : ratio} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  logo: { position: "absolute", right: 4, bottom: 4, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  logoInitial: { fontSize: 10, fontWeight: "800" },
  // Наклейка выступает за угол миниатюры (−4/−2): «приклеена» поверх, а не вписана внутрь.
  stamp: { position: "absolute", top: -2, left: -4 },
});
