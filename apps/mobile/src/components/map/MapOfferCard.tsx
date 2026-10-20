import React from "react";
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import MapPin from "lucide-react-native/icons/map-pin";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { getOfferUrgencyRatio, type NearbyOffer } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { glassTokens } from "../../theme/glass";
import { useNow } from "../../hooks/useNow";
import { getTimeLeft } from "../../utils/time";
import { timeLeftLabel } from "../../utils/timeLabel";
import { isHotOffer } from "../../utils/offers";
import { OfferThumb } from "../OfferThumb";
import { isKeyboardFocus } from "../../utils/focus";
import { FuseTimer, TimeLeftText } from "../FuseTimer";

export const MAP_CARD_HEIGHT = 112;
const THUMB = 80;

/** Размываем то, что лежит под карточкой (web); на native RN такого фильтра не умеет — там работает полупрозрачность. */
const frosted = Platform.OS === "web" ? ({ backdropFilter: "blur(18px) saturate(1.35)" } as ViewStyle) : null;

interface MapOfferCardProps {
  offer: NearbyOffer;
  width: number;
  /** Карточка «под пальцем»: её пин подсвечен на карте. Нажатие по ней открывает предложение, по соседней — выбирает её. */
  selected: boolean;
  onSelect: (offerId: string) => void;
  onOpen: (offerId: string) => void;
}

/**
 * Компактная карточка предложения для ленты под картой: стеклянная поверхность, миниатюра с наклейкой скидки, название,
 * заведение и расстояние, цена и остаток времени, «фитиль» по нижнему краю — тот же язык, что у списка, но в ~112 px
 * высотой, чтобы карта оставалась главной. Выбранная карточка получает рамку жара и стрелку «открыть»; у остальных
 * касание только выбирает их (карта летит к пину) — случайно открыть чужое предложение нельзя.
 */
export const MapOfferCard = React.memo(function MapOfferCard({ offer, width, selected, onSelect, onOpen }: MapOfferCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow();
  const timeLeft = getTimeLeft(offer.pickupEnd, now);
  const ratio = getOfferUrgencyRatio(offer, now);
  const closed = timeLeft.isPast;
  const hot = isHotOffer(offer, now);
  const accent = hot ? theme.colors.ember : theme.colors.primary;
  const g = glassTokens(theme.mode, hot ? "ember" : "mint");
  const price = `${(offer.discountedPrice / 100).toFixed(0)} ₽`;

  const label = [
    t("map.cardLabel", { title: offer.title, venue: offer.businessName, price, discount: offer.discountPercent, time: timeLeftLabel(t, timeLeft) }),
    selected ? t("map.openOffer") : t("map.showOnMap"),
  ].join(". ");

  return (
    <Pressable
      onPress={() => (selected ? onOpen(offer.id) : onSelect(offer.id))}
      // Клавиатура/скринридер: фокус на карточке сразу показывает её на карте — не надо жать Enter «на пробу».
      // Но не фокус от мыши/пальца: на web касание тоже фокусирует кнопку ДО клика, карточка успела бы стать «выбранной»
      // и тот же тап открыл бы чужое предложение вместо того, чтобы лишь выбрать его.
      onFocus={(event) => !selected && isKeyboardFocus(event) && onSelect(offer.id)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      // aria-selected на role=button недопустим (axe), а «текущий элемент набора» выражается именно aria-current (RN-web пробрасывает его в DOM).
      {...({ "aria-current": selected ? "true" : undefined } as object)}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.92 : 1, cursor: "pointer" } as ViewStyle]}
    >
      <View
        style={[
          styles.card,
          frosted,
          {
            height: MAP_CARD_HEIGHT,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.mode === "dark" ? "rgba(18,26,25,0.86)" : "rgba(255,255,255,0.88)",
            borderColor: selected ? accent : g.border,
            borderWidth: selected ? 1.5 : 1,
            boxShadow: selected ? `0 10px 30px ${accent}38, 0 2px 8px rgba(0,0,0,0.12)` : theme.mode === "dark" ? "0 6px 20px rgba(0,0,0,0.4)" : "0 6px 20px rgba(22,32,30,0.12)",
          } as ViewStyle,
        ]}
      >
        <OfferThumb offer={offer} size={THUMB} ratio={ratio} hot={hot} closed={closed} />

        <View style={styles.body}>
          <Text style={[styles.title, { color: theme.colors.text }, selected && styles.titleSelected]} numberOfLines={2}>
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
              <Text style={[theme.fonts.heavy, styles.price, { color: accent }]}>{price}</Text>
              <Text style={[styles.original, { color: theme.colors.textMuted }]}>{(offer.originalPrice / 100).toFixed(0)} ₽</Text>
            </View>
            <TimeLeftText pickupEnd={offer.pickupEnd} />
          </View>
        </View>

        {selected ? (
          // Только намёк «сюда можно нажать»: всё касание карточки и так открывает предложение, а скринридер читает «Открыть» в подписи.
          <View style={[styles.open, { backgroundColor: accent }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            <ChevronRight size={16} color={hot ? "#1a0b02" : theme.colors.onPrimary} strokeWidth={2.6} />
          </View>
        ) : null}

        <FuseTimer pickupEnd={offer.pickupEnd} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingBottom: 10, paddingTop: 8, overflow: "hidden" },
  body: { flex: 1, minWidth: 0, gap: 2, paddingRight: 2 },
  title: { fontSize: 14.5, lineHeight: 18, fontWeight: "700", letterSpacing: -0.1 },
  // Под стрелку «открыть» название чуть короче — не заходит под неё.
  titleSelected: { paddingRight: 26 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  meta: { fontSize: 12, flexShrink: 1 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  priceGroup: { flexDirection: "row", alignItems: "baseline", gap: 6, flexShrink: 1 },
  price: { fontSize: 15 },
  original: { fontSize: 11.5, textDecorationLine: "line-through" },
  open: { position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
