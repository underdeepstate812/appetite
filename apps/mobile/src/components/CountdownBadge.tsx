import React from "react";
import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useNow } from "../hooks/useNow";
import { getTimeLeft, getUrgencyLevel } from "../utils/time";

export function CountdownBadge({ pickupEnd }: { pickupEnd: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow();
  const timeLeft = getTimeLeft(pickupEnd, now);
  const urgency = getUrgencyLevel(timeLeft);

  const color =
    urgency === "urgent"
      ? theme.colors.danger
      : urgency === "soon"
        ? theme.colors.warning
        : theme.colors.textMuted;

  const label = timeLeft.isPast
    ? t("offerCard.pickupClosed")
    : timeLeft.hours > 0
      ? t("offerCard.timeLeftHours", { hours: timeLeft.hours, minutes: timeLeft.minutes })
      : t("offerCard.timeLeftMinutes", { minutes: timeLeft.minutes });

  return <Text style={[styles.text, { color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 12, fontWeight: "700" },
});
