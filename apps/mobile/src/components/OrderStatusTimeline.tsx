import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useNow } from "../hooks/useNow";
import { getTimeLeft } from "../utils/time";

interface OrderStatusTimelineProps {
  pickupStart: string;
  pickupEnd: string;
}

type StageKey = "confirmed" | "preparing" | "ready";

const STAGES: StageKey[] = ["confirmed", "preparing", "ready"];
const STAGE_ICONS: Record<StageKey, string> = {
  confirmed: "✓",
  preparing: "🧑‍🍳",
  ready: "🛍️",
};

/**
 * "Готовится → можно забирать" по времени pickupStart/pickupEnd — у нас нет отдельного
 * бэкенд-статуса на эти промежуточные стадии (Order.status только CONFIRMED/COMPLETED/...),
 * так что стадия выводится на клиенте из времени, а не хранится отдельно.
 *
 * Анимация — только transform/opacity (useNativeDriver: true), не layout-свойства:
 * одинаково дёшево на native и web, без просадки кадров.
 */
export function OrderStatusTimeline({ pickupStart, pickupEnd }: OrderStatusTimelineProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow(15000);

  const isReady = now >= new Date(pickupStart).getTime();
  const currentIndex = isReady ? 2 : 1;

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isReady) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isReady, pulse]);

  const hint = useMemo(() => {
    if (isReady) {
      const endLabel = new Date(pickupEnd).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      return t("orderStatus.readyHint", { time: endLabel });
    }
    const timeLeft = getTimeLeft(pickupStart, now);
    return timeLeft.hours > 0
      ? t("orderStatus.preparingHint", { hours: timeLeft.hours, minutes: timeLeft.minutes })
      : t("orderStatus.preparingHintMinutes", { minutes: timeLeft.minutes });
  }, [isReady, pickupStart, pickupEnd, now, t]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {STAGES.map((stageKey, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;
          const isReadyNode = stageKey === "ready";
          const accentColor = isReadyNode && (isActive || isDone) ? theme.colors.success : theme.colors.primary;
          const softColor = isReadyNode && (isActive || isDone) ? theme.colors.successSoft : theme.colors.primarySoft;
          const circleBg = isDone ? accentColor : isActive ? softColor : "transparent";
          const circleBorder = isDone || isActive ? accentColor : theme.colors.border;

          return (
            <React.Fragment key={stageKey}>
              <View style={styles.node}>
                <Animated.View
                  style={[
                    styles.circle,
                    {
                      backgroundColor: circleBg,
                      borderColor: circleBorder,
                      transform: [{ scale: isActive ? pulse : 1 }],
                    },
                  ]}
                >
                  <Text style={[styles.icon, isDone && { color: theme.colors.onPrimary }]}>
                    {STAGE_ICONS[stageKey]}
                  </Text>
                </Animated.View>
                <Text
                  style={[
                    theme.typography.caption,
                    {
                      color: isDone || isActive ? theme.colors.text : theme.colors.textMuted,
                      marginTop: 6,
                      textAlign: "center",
                    },
                  ]}
                  numberOfLines={2}
                >
                  {t(`orderStatus.${stageKey}`)}
                </Text>
              </View>
              {index < STAGES.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: index < currentIndex ? theme.colors.primary : theme.colors.border },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      <View
        style={[
          styles.hintBadge,
          { backgroundColor: isReady ? theme.colors.successSoft : theme.colors.primarySoft, borderRadius: theme.radii.full },
        ]}
      >
        <Text style={[theme.typography.bodyBold, { color: isReady ? theme.colors.success : theme.colors.primary }]}>
          {hint}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginVertical: 12 },
  row: { flexDirection: "row", alignItems: "flex-start", width: "100%", paddingHorizontal: 4 },
  node: { alignItems: "center", width: 88 },
  circle: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 18 },
  connector: { flex: 1, height: 2, marginTop: 21 },
  hintBadge: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10 },
});
