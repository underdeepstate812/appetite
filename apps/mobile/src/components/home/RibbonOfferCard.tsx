import React from "react";
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import MapPin from "lucide-react-native/icons/map-pin";
import { getOfferUrgencyRatio, type NearbyOffer } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { glassTokens } from "../../theme/glass";
import { useNow } from "../../hooks/useNow";
import { getTimeLeft } from "../../utils/time";
import { timeLeftLabel } from "../../utils/timeLabel";
import { isHotOffer } from "../../utils/offers";
import { isKeyboardFocus } from "../../utils/focus";
import { RIBBON_CARD_HEIGHT, RIBBON_CARD_WIDTH } from "../../utils/ribbon";
import { OfferThumb } from "../OfferThumb";
import { FuseTimer, TimeLeftText } from "../FuseTimer";

const THUMB = 60;
const frosted = Platform.OS === "web" ? ({ backdropFilter: "blur(14px) saturate(1.3)" } as ViewStyle) : null;

interface RibbonOfferCardProps {
  offer: NearbyOffer;
  onPress: (offer: NearbyOffer) => void;
  /** Копия для бесшовной петли: на экране есть, для скринридера и Tab — нет (иначе каждое предложение читалось бы дважды). */
  decorative?: boolean;
  /** Палец/указатель/фокус на карточке — лента замирает (нельзя нажать то, что уезжает из-под пальца). */
  onHold?: (source: HoldSource, on: boolean) => void;
}

export type HoldSource = "press" | "hover" | "focus";

/**
 * Компактная карточка для бегущей ленты (≈248×84): миниатюра с наклейкой скидки, название в одну строку, заведение и
 * расстояние, цена и остаток времени, «фитиль» по нижнему краю. Тот же язык, что у карточки на карте и в списке, только
 * ниже и уже — в кадре помещается 1,5 карточки на телефоне.
 */
export const RibbonOfferCard = React.memo(function RibbonOfferCard({ offer, onPress, decorative = false, onHold }: RibbonOfferCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow();
  const timeLeft = getTimeLeft(offer.pickupEnd, now);
  const ratio = getOfferUrgencyRatio(offer, now);
  const hot = isHotOffer(offer, now);
  const accent = hot ? theme.colors.ember : theme.colors.primary;
  const g = glassTokens(theme.mode, hot ? "ember" : "mint");
  const price = `${(offer.discountedPrice / 100).toFixed(0)} ₽`;
  const label = `${t("map.cardLabel", { title: offer.title, venue: offer.businessName, price, discount: offer.discountPercent, time: timeLeftLabel(t, timeLeft) })}. ${t("map.openOffer")}`;

  return (
    <Pressable
      onPress={() => onPress(offer)}
      onPressIn={() => onHold?.("press", true)}
      onPressOut={() => onHold?.("press", false)}
      onHoverIn={() => onHold?.("hover", true)}
      onHoverOut={() => onHold?.("hover", false)}
      // Только фокус с клавиатуры: касание тоже фокусирует кнопку и фокус остаётся после тапа — лента замерла бы навсегда.
      onFocus={decorative ? undefined : (event) => isKeyboardFocus(event) && onHold?.("focus", true)}
      onBlur={decorative ? undefined : () => onHold?.("focus", false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      focusable={!decorative}
      // RN-web у Pressable смотрит именно на tabIndex (focusable он игнорирует): без него копия оставалась бы в порядке Tab.
      tabIndex={decorative ? -1 : undefined}
      accessible={!decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={decorative}
      {...(decorative ? ({ "aria-hidden": true } as object) : null)}
      style={({ pressed }) => [{ width: RIBBON_CARD_WIDTH, height: RIBBON_CARD_HEIGHT, opacity: pressed ? 0.92 : 1, cursor: "pointer" } as ViewStyle]}
    >
      <View
        style={[
          styles.card,
          frosted,
          {
            borderRadius: theme.radii.lg,
            backgroundColor: theme.mode === "dark" ? "rgba(18,26,25,0.82)" : "rgba(255,255,255,0.86)",
            borderColor: g.border,
            boxShadow: theme.mode === "dark" ? "0 4px 14px rgba(0,0,0,0.35)" : "0 4px 14px rgba(22,32,30,0.1)",
          } as ViewStyle,
        ]}
      >
        <OfferThumb offer={offer} size={THUMB} ratio={ratio} hot={hot} closed={timeLeft.isPast} />
        <View style={styles.body}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {offer.title}
          </Text>
          <View style={styles.metaRow}>
            <MapPin size={10.5} color={theme.colors.textMuted} strokeWidth={2.2} />
            <Text style={[styles.meta, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {offer.businessName} · {offer.distanceKm.toFixed(1)} {t("common.km")}
            </Text>
          </View>
          <View style={styles.bottomRow}>
            <Text style={[theme.fonts.heavy, styles.price, { color: accent }]} numberOfLines={1}>
              {price}
            </Text>
            <TimeLeftText pickupEnd={offer.pickupEnd} />
          </View>
        </View>
        <FuseTimer pickupEnd={offer.pickupEnd} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingBottom: 8, paddingTop: 6, borderWidth: 1, overflow: "hidden" },
  body: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 14, lineHeight: 18, fontWeight: "700", letterSpacing: -0.1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  meta: { fontSize: 11.5, flexShrink: 1 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 3 },
  price: { fontSize: 15, flexShrink: 1 },
});
