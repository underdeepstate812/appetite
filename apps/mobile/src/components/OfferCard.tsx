import React, { useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
// Прямые импорты вместо барреля lucide-react-native — package.json объявляет
// exports["./icons/*"] именно под это: на Metro (без tree-shaking барреля)
// не бандлим тысячи неиспользуемых иконок ради пяти нужных.
import UtensilsCrossed from "lucide-react-native/icons/utensils-crossed";
import Croissant from "lucide-react-native/icons/croissant";
import Flower2 from "lucide-react-native/icons/flower-2";
import ShoppingBasket from "lucide-react-native/icons/shopping-basket";
import MapPin from "lucide-react-native/icons/map-pin";
import { OfferCategory, type NearbyOffer } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";
import { heatColor } from "../theme/heat";
import { useNow } from "../hooks/useNow";
import { getTimeLeft, getUrgencyRatio } from "../utils/time";
import { isHotOffer } from "../utils/offers";
import { contour, hashString } from "../utils/contour";
import { DiscountStamp } from "./DiscountStamp";
import { FuseTimer, TimeLeftText } from "./FuseTimer";

const CATEGORY_ICON = {
  [OfferCategory.FOOD]: UtensilsCrossed,
  [OfferCategory.BAKERY]: Croissant,
  [OfferCategory.FLOWERS]: Flower2,
  [OfferCategory.GROCERIES]: ShoppingBasket,
} as const;

interface OfferCardProps {
  offer: NearbyOffer;
  onPress: () => void;
}

const THUMB = 72;


/**
 * Компактная карточка-строка: миниатюра слева, данные справа — ~98px по высоте.
 * Детали: скидка — штамп-оттиск на углу миниатюры; вместо плашки-таймера — "фитиль",
 * сгорающий вдоль нижнего края; у горящих ember-рамка и свечение под карточкой; на hover
 * карточка приподнимается, а по ней проходит блик. Раскладка (миниатюра → название →
 * заведение → цена → время) прежняя.
 */
export function OfferCard({ offer, onPress }: OfferCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow();
  const timeLeft = getTimeLeft(offer.pickupEnd, now);
  const ratio = getUrgencyRatio(timeLeft);
  const closed = timeLeft.isPast;
  const hot = isHotOffer(offer, now);
  const dark = theme.mode === "dark";

  const accent = hot ? theme.colors.ember : theme.colors.primary;
  const tint = theme.colors.primarySoft;
  // Изолинии миниатюры: у каждого предложения свой рисунок (фаза из id), тот же язык, что топо-фон пропуска.
  const phase = hashString(offer.id) * Math.PI * 2;
  const glowColor = heatColor(ratio, theme.mode);

  // Hover (web / десктоп): подъём и лёгкое увеличение через native driver + блик.
  // На тач-устройствах hover не срабатывает — там остаётся pressed-отклик.
  const hover = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const [cardWidth, setCardWidth] = useState(320);

  const setHover = (on: boolean) => {
    setHovered(on);
    Animated.spring(hover, { toValue: on ? 1 : 0, useNativeDriver: true, speed: 28, bounciness: 5 }).start();
    if (on) {
      sheen.setValue(0);
      Animated.timing(sheen, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    }
  };

  const lift = hover.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const grow = hover.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] });
  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-90, cardWidth + 60] });

  const Icon = CATEGORY_ICON[offer.category];
  const glow = hot ? (dark ? "rgba(255,138,61,0.30)" : "rgba(194,65,12,0.22)") : dark ? "rgba(45,212,191,0.22)" : "rgba(15,118,110,0.18)";
  const restingShadow = hot ? `0 6px 18px ${glow}` : dark ? "0 4px 14px rgba(0,0,0,0.35)" : "0 3px 12px rgba(22,32,30,0.06)";
  const onLayout = (event: LayoutChangeEvent) => setCardWidth(event.nativeEvent.layout.width);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.pressWrap, { opacity: pressed ? 0.9 : 1, cursor: "pointer" }]}
    >
      <Animated.View
        style={[
          styles.shell,
          { borderRadius: theme.radii.lg, boxShadow: hovered ? `0 12px 26px ${glow}` : restingShadow },
          { transform: [{ translateY: lift }, { scale: grow }] },
        ]}
      >
        <View
          onLayout={onLayout}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <View style={[styles.thumb, { backgroundColor: tint }]}>
            <Svg width={THUMB} height={THUMB} style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id={`wash-${offer.id}`} cx="0" cy="0" r={THUMB * 1.25} gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={glowColor} stopOpacity={hot ? (dark ? 0.32 : 0.22) : 0} />
                  <Stop offset="1" stopColor={glowColor} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width={THUMB} height={THUMB} fill={`url(#wash-${offer.id})`} />
              {[16, 27, 38].map((radius, index) => (
                <Path key={radius} d={contour(THUMB * 0.62, THUMB * 0.56, radius, phase + index * 0.7, 0.85)} fill="none" stroke={accent} strokeOpacity={0.36 - index * 0.11} strokeWidth={1.2} />
              ))}
            </Svg>
            {offer.imageUrl ? (
              <Image source={{ uri: offer.imageUrl }} style={styles.thumbImage} resizeMode="cover" />
            ) : (
              <Icon size={26} color={accent} strokeWidth={1.7} />
            )}
            <View style={[styles.logoBadge, { backgroundColor: theme.colors.surfaceElevated }]}>
              {offer.businessLogoUrl ? (
                <Image source={{ uri: offer.businessLogoUrl }} style={styles.logoImage} />
              ) : (
                <Text style={[styles.logoInitial, { color: accent }]}>{offer.businessName.charAt(0)}</Text>
              )}
            </View>
          </View>

          <View style={styles.stampSlot} pointerEvents="none">
            <DiscountStamp percent={offer.discountPercent} ratio={closed ? 0 : ratio} />
          </View>

          <View style={styles.body}>
            <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
              {offer.title}
            </Text>
            <View style={styles.metaRow}>
              <MapPin size={11} color={theme.colors.textMuted} strokeWidth={2.2} />
              <Text style={[styles.meta, { color: theme.colors.textMuted }]} numberOfLines={1}>
                {offer.businessName} · {offer.distanceKm.toFixed(1)} {t("common.km")}
              </Text>
            </View>

            <View style={styles.bottomRow}>
              <View style={styles.priceGroup}>
                <Text style={[theme.fonts.heavy, styles.price, { color: accent }]}>{(offer.discountedPrice / 100).toFixed(0)} ₽</Text>
                <Text style={[styles.originalPrice, { color: theme.colors.textMuted }]}>{(offer.originalPrice / 100).toFixed(0)} ₽</Text>
              </View>
              <TimeLeftText pickupEnd={offer.pickupEnd} />
            </View>
          </View>

          <FuseTimer pickupEnd={offer.pickupEnd} />

          <Animated.View
            pointerEvents="none"
            style={[styles.sheen, { backgroundColor: dark ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.7)", transform: [{ translateX: sheenX }, { rotate: "18deg" }] }]}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressWrap: { width: "100%", flexGrow: 1 },
  shell: { flexGrow: 1 },
  card: { flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 10, paddingBottom: 18, borderWidth: 1, overflow: "hidden" },
  thumb: { width: THUMB, height: THUMB, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  stampSlot: { position: "absolute", top: 8, left: 6 },
  logoBadge: { position: "absolute", right: 4, bottom: 4, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  logoInitial: { fontSize: 10, fontWeight: "800" },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 14.5, lineHeight: 18, fontWeight: "700", letterSpacing: -0.1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  meta: { fontSize: 12, flexShrink: 1 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  priceGroup: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  price: { fontSize: 15 },
  originalPrice: { fontSize: 11.5, textDecorationLine: "line-through" },
  sheen: { position: "absolute", top: -30, bottom: -30, width: 46, left: 0 },
});
