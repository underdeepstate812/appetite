import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { heatColor, heatInk } from "../theme/heat";
import { useNow } from "../hooks/useNow";
import { useBreath } from "../hooks/useBreath";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { getTimeLeft, getUrgencyRatio } from "../utils/time";

/** Доля 3-часового окна, при которой предложение считается "горящим" (совпадает с isHotOffer). */
const HOT_RATIO = 0.55;
const WARM_RATIO = 0.33;

/**
 * Фитиль: вместо таблетки-таймера тонкая линия вдоль нижнего края карточки, которая "сгорает"
 * справа налево по мере истечения окна самовывоза. Цвет — шкала жара; спокойное предложение
 * (до 1/3 окна) — тихая линия без головы, "тёплое" получает точку-искру, "горящее" — искру с
 * ореолом, которая дышит (одно общее значение на весь список — см. useBreath). Тики на 1/3 и
 * 2/3 длины — пороги "скоро" и "срочно". Срочность читается периферийным зрением, без цифр.
 */
export function FuseTimer({ pickupEnd }: { pickupEnd: string }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const now = useNow();
  const timeLeft = getTimeLeft(pickupEnd, now);
  const ratio = getUrgencyRatio(timeLeft);
  const remaining = timeLeft.isPast ? 0 : 1 - ratio;
  const color = heatColor(ratio, theme.mode);
  const warm = !timeLeft.isPast && ratio >= WARM_RATIO;
  const hot = !timeLeft.isPast && ratio >= HOT_RATIO;
  const breath = useBreath(hot && !reduced);

  const length = useRef(new Animated.Value(remaining)).current;
  useEffect(() => {
    Animated.timing(length, { toValue: remaining, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [remaining, length]);

  const width = length.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const left = length.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const haloScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] });
  const haloOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });

  return (
    <View style={styles.track} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.rail, { backgroundColor: theme.colors.border }]} />
      <View style={[styles.tick, { left: "33.3%", backgroundColor: theme.colors.border }]} />
      <View style={[styles.tick, { left: "66.6%", backgroundColor: theme.colors.border }]} />
      <Animated.View style={[styles.line, { width, backgroundColor: color, opacity: warm ? 1 : 0.55 }]} />
      {warm ? (
        <Animated.View style={[styles.headSlot, { left }]}>
          <Animated.View
            style={[
              hot ? styles.headHot : styles.headWarm,
              { backgroundColor: color, boxShadow: hot ? `0 0 10px 2px ${color}aa` : `0 0 6px ${color}88` },
              hot ? { opacity: haloOpacity, transform: [{ scale: haloScale }] } : null,
            ]}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Остаток времени цифрами — "чернильным" цветом шкалы (≥5:1 на любой поверхности), не голым цветом линии. */
export function TimeLeftText({ pickupEnd }: { pickupEnd: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow();
  const timeLeft = getTimeLeft(pickupEnd, now);
  // Закрытое окно — не "горит", а просто закончилось: приглушённый цвет, не красный.
  const color = timeLeft.isPast ? theme.colors.textMuted : heatInk(getUrgencyRatio(timeLeft), theme.mode, theme.colors.text);

  const label = timeLeft.isPast
    ? t("offerCard.pickupClosed")
    : timeLeft.hours > 0
      ? t("offerCard.timeLeftHours", { hours: timeLeft.hours, minutes: timeLeft.minutes })
      : t("offerCard.timeLeftMinutes", { minutes: timeLeft.minutes });

  return <Text style={[theme.fonts.bold, styles.label, { color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  track: { position: "absolute", left: 14, right: 14, bottom: 6, height: 6, justifyContent: "center" },
  rail: { position: "absolute", left: 0, right: 0, height: 2, borderRadius: 1, opacity: 0.8 },
  tick: { position: "absolute", width: 1, height: 5, opacity: 0.9 },
  line: { position: "absolute", left: 0, height: 3, borderRadius: 2 },
  headSlot: { position: "absolute", width: 0, height: 6, alignItems: "center", justifyContent: "center" },
  headWarm: { width: 6, height: 6, borderRadius: 3 },
  headHot: { width: 9, height: 9, borderRadius: 5 },
  label: { fontSize: 11.5, fontVariant: ["tabular-nums"] },
});
