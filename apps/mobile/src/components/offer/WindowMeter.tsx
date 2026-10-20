import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getOfferUrgencyRatio, heatColor, heatInk, type Offer } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { useNow } from "../../hooks/useNow";
import { formatPickupWindow, windowOpensLater, windowRemaining } from "../../utils/pickup";
import { getTimeLeft } from "../../utils/time";

type WindowOffer = Pick<Offer, "pickupStart" | "pickupEnd" | "featured">;

/**
 * Окно самовывоза: крупно «сколько осталось» (цветом жара), «фитиль» — доля окна, что ещё не сгорела, и
 * человеческая запись окна («17:35 — завтра 18:35»). Если окно ещё не открылось, говорим об этом прямо:
 * заказать можно заранее, но забрать — только с этого момента. Закрытое окно — приглушённо, не красным.
 */
export function WindowMeter({ offer, locale }: { offer: WindowOffer; locale: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow(30000);
  const timeLeft = getTimeLeft(offer.pickupEnd, now);
  const closed = timeLeft.isPast;
  const later = !closed && windowOpensLater(offer.pickupStart, now);
  const ratio = getOfferUrgencyRatio(offer, now);
  const remaining = windowRemaining(offer.pickupStart, offer.pickupEnd, now);
  const fill = closed ? theme.colors.textMuted : heatColor(ratio, theme.mode);
  const ink = closed ? theme.colors.textMuted : heatInk(ratio, theme.mode, theme.colors.text);

  const timeText =
    timeLeft.hours > 0
      ? t("offerCard.timeLeftHours", { hours: timeLeft.hours, minutes: timeLeft.minutes })
      : t("offerCard.timeLeftMinutes", { minutes: timeLeft.minutes });
  const headline = closed ? t("offerDetail.windowClosed") : t("offerDetail.windowLeft", { time: timeText });
  const range = formatPickupWindow(offer.pickupStart, offer.pickupEnd, { tomorrow: t("offerDetail.tomorrow"), locale });
  const startTime = new Date(offer.pickupStart).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <View>
      <Text style={[theme.fonts.bold, styles.headline, { color: ink }]}>{headline}</Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={headline}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(remaining * 100) }}
        style={[styles.track, { backgroundColor: theme.colors.border }]}
      >
        <View style={[styles.fill, { width: `${Math.round(remaining * 100)}%`, backgroundColor: fill }]}>
          {!closed && remaining > 0 ? <View style={[styles.spark, { backgroundColor: fill, boxShadow: `0 0 8px 2px ${fill}aa` }]} /> : null}
        </View>
      </View>
      <Text style={[styles.range, { color: theme.colors.text }]}>{t("offerDetail.windowRange", { range })}</Text>
      {later ? <Text style={[styles.note, { color: theme.colors.textMuted }]}>{t("offerDetail.windowOpensAt", { time: startTime })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headline: { fontSize: 20, lineHeight: 26 },
  track: { marginTop: 12, height: 5, borderRadius: 3 },
  fill: { height: 5, borderRadius: 3, justifyContent: "center", alignItems: "flex-end" },
  spark: { width: 11, height: 11, borderRadius: 6, marginRight: -5 },
  range: { marginTop: 12, fontSize: 14.5, fontWeight: "600" },
  note: { marginTop: 4, fontSize: 13 },
});
