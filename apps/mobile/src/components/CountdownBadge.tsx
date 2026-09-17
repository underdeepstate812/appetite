import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useNow } from "../hooks/useNow";
import { getTimeLeft, getUrgencyRatio } from "../utils/time";

/**
 * FOMO-таймер в стиле "тактильного максимализма" из брифа: не резкий
 * 3-статусный переключатель, а непрерывно "тающий" цвет — мягкая пилюля,
 * плавно съезжающая от зелёного к неоново-оранжевому по мере истечения
 * окна самовывоза. Animated.timing на каждый тик useNow (раз в 30с) даёт
 * ощущение непрерывного дрейфа, а не мгновенного скачка.
 */
export function CountdownBadge({ pickupEnd }: { pickupEnd: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow();
  const timeLeft = getTimeLeft(pickupEnd, now);
  const ratio = getUrgencyRatio(timeLeft);

  const anim = useRef(new Animated.Value(ratio)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: ratio, duration: 1400, useNativeDriver: false }).start();
  }, [ratio, anim]);

  const backgroundColor = anim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [theme.colors.successSoft, theme.colors.warningSoft, theme.colors.dangerSoft],
  });
  const textColor = anim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [theme.colors.success, theme.colors.warning, theme.colors.danger],
  });

  const label = timeLeft.isPast
    ? t("offerCard.pickupClosed")
    : timeLeft.hours > 0
      ? t("offerCard.timeLeftHours", { hours: timeLeft.hours, minutes: timeLeft.minutes })
      : t("offerCard.timeLeftMinutes", { minutes: timeLeft.minutes });

  return (
    <Animated.View style={[styles.pill, { backgroundColor, borderRadius: theme.radii.full }]}>
      <Animated.Text style={[styles.text, { color: textColor }]}>{label}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  text: { fontSize: 12, fontWeight: "700" },
});
