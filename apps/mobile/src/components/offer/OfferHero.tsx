import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Flame from "lucide-react-native/icons/flame";
import { useTranslation } from "react-i18next";
import type { Offer } from "@apetite/shared";
import { resolveAssetUrl } from "../../api/client";
import { useTheme } from "../../theme/ThemeProvider";
import { useUniqueId } from "../../hooks/useUniqueId";
import { DiscountStamp } from "../DiscountStamp";
import { HeroArt } from "../HeroArt";
import { CATEGORY_ICON } from "./categoryIcon";

interface OfferHeroProps {
  offer: Pick<Offer, "imageUrl" | "category" | "title" | "discountPercent" | "featured">;
  /** Жар оффера 0..1 — цвет наклейки скидки. */
  ratio: number;
  hot: boolean;
  /** На широком экране фото — скруглённая карточка, на узком — во всю ширину с мягким низом. */
  wide: boolean;
}

const HEIGHT = 248;

/**
 * Герой оффера: фото блюда на весь верх экрана, а если его нет (или оно не загрузилось) — фирменная картинка
 * с иконкой категории: пустой серый блок выглядел бы поломкой. Поверх: «Горит»/«Предложение дня» и крупная
 * наклейка скидки, которая окрашена жаром оффера. Нижний скрим держит контраст наклейки на любом фото.
 */
export function OfferHero({ offer, ratio, hot, wide }: OfferHeroProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const scrimId = useUniqueId("heroScrim");
  const [failed, setFailed] = useState(false);
  const src = resolveAssetUrl(offer.imageUrl);
  const Icon = CATEGORY_ICON[offer.category];

  return (
    <View style={[styles.hero, wide ? styles.heroWide : styles.heroNarrow]}>
      {src && !failed ? (
        <Image source={{ uri: src }} resizeMode="cover" onError={() => setFailed(true)} style={StyleSheet.absoluteFill} accessibilityLabel={offer.title} />
      ) : (
        <View style={styles.placeholder} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <HeroArt variant="quiet" />
          <View style={[styles.iconTile, { backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.22)" }]}>
            <Icon size={46} color="#ffffff" strokeWidth={1.6} />
          </View>
        </View>
      )}
      <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={scrimId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.45" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.5} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${scrimId})`} />
      </Svg>

      {hot ? (
        <View style={[styles.badge, { backgroundColor: offer.featured ? theme.colors.ember : "rgba(18,16,13,0.72)" }]}>
          <Flame size={14} color="#ffffff" strokeWidth={2.4} />
          <Text style={styles.badgeText}>{offer.featured ? t("offerDetail.featured") : t("offerDetail.hot")}</Text>
        </View>
      ) : null}

      <View style={styles.stamp}>
        <DiscountStamp percent={offer.discountPercent} ratio={ratio} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: HEIGHT, overflow: "hidden", backgroundColor: "#052e2b" },
  heroNarrow: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroWide: { borderRadius: 24, marginTop: 8 },
  placeholder: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  iconTile: { width: 92, height: 92, borderRadius: 28, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 14, left: 16, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
  badgeText: { color: "#ffffff", fontSize: 12.5, fontWeight: "700" },
  // Наклейка крупнее, чем на карточке списка: на экране оффера скидка — главный довод.
  stamp: { position: "absolute", left: 22, bottom: 20, transform: [{ scale: 1.55 }], transformOrigin: "left bottom" } as object,
});
