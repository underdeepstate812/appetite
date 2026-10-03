import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Check from "lucide-react-native/icons/check";
import ChefHat from "lucide-react-native/icons/chef-hat";
import { useTheme } from "../theme/ThemeProvider";
import { heatColor, heatInk, heatTint } from "../theme/heat";
import { useNow } from "../hooks/useNow";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { getReadiness, getTimeLeft } from "../utils/time";
import { FryingPanIcon } from "./icons/FryingPanIcon";

interface OrderStatusTimelineProps {
  pickupStart: string;
  pickupEnd: string;
  /**
   * Пока не задано — заведение ещё не подтвердило заказ (кнопка "Отменить" в
   * OrderDetailScreen.tsx ещё активна), и шкала обязана честно стоять на "Оплачено", а не
   * показывать "Готовится" только по одному времени — иначе получается прямое противоречие
   * интерфейса самому себе: одна часть экрана утверждает "уже готовят", другая тут же
   * предлагает отменить то, что "уже готовят". Готовность (% и фитиль) считается уже от
   * этого момента, а не от момента оплаты — именно с него на кухне реально что-то началось.
   */
  acceptedAt?: string | null;
}

type StageKey = "confirmed" | "preparing" | "ready";

const STAGES: StageKey[] = ["confirmed", "preparing", "ready"];
const NODE = 42;

/**
 * "Оплачено → готовится → можно забирать" по времени pickupStart/pickupEnd — отдельного
 * бэкенд-статуса на промежуточные стадии нет (Order.status только CONFIRMED/COMPLETED/...),
 * поэтому стадия и степень готовности выводятся на клиенте из времени.
 *
 * Между стадиями — фитиль. Пока заказ готовится, второй отрезок заполняется бирюзой до
 * текущей степени готовности (прогресс красится не жаром, а брендом, на конце мятная искра).
 * Когда заказ готов, тот же отрезок превращается в фитиль окна выдачи: он догорает справа
 * налево в цветах жара — как на карточке предложения, потому что это то же самое время.
 */
export function OrderStatusTimeline({ pickupStart, pickupEnd, acceptedAt }: OrderStatusTimelineProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const now = useNow(15000);

  const start = new Date(pickupStart).getTime();
  const end = new Date(pickupEnd).getTime();
  const isReady = now >= start;
  const isAccepted = !!acceptedAt;
  const currentIndex = isReady ? 2 : isAccepted ? 1 : 0;
  // До подтверждения заведением готовность физически ещё не началась — 0, а не фейковый
  // процент от момента оплаты (orderedAt тут больше не используется для этого расчёта).
  const readiness = isAccepted ? getReadiness(acceptedAt, pickupStart, now) : 0;
  const percent = Math.round(readiness * 100);

  // Окно выдачи: 1 — только открылось, 0 — закрылось. Жар растёт по мере того, как оно догорает.
  const windowRemaining = isReady && end > start ? Math.min(1, Math.max(0, (end - now) / (end - start))) : 1;
  const windowRatio = 1 - windowRemaining;

  const dark = theme.mode === "dark";
  const mint = dark ? "#b8fbef" : theme.colors.primary;
  const fuseColor = isReady ? heatColor(windowRatio, theme.mode) : theme.colors.primary;
  const fuseTarget = isReady ? windowRemaining : readiness;

  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: fuseTarget, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [fuseTarget, fill]);
  const fillWidth = fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  const hint = useMemo(() => {
    if (isReady) {
      const endLabel = new Date(pickupEnd).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      return t("orderStatus.readyHint", { time: endLabel });
    }
    if (!isAccepted) return t("orderStatus.waitingAcceptanceHint");
    const timeLeft = getTimeLeft(pickupStart, now);
    return timeLeft.hours > 0
      ? t("orderStatus.preparingHint", { hours: timeLeft.hours, minutes: timeLeft.minutes })
      : t("orderStatus.preparingHintMinutes", { minutes: timeLeft.minutes });
  }, [isReady, isAccepted, pickupStart, pickupEnd, now, t]);

  // Подсказка: пока готовится — спокойная бирюзовая, когда готово — цвет жара окна выдачи.
  const chipBg = isReady ? heatTint(windowRatio, theme.mode, theme.colors.background) : theme.colors.primarySoft;
  const accent = isReady ? heatInk(windowRatio, theme.mode, theme.colors.text) : theme.colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.rail}>
          <View style={[styles.railLine, { backgroundColor: theme.colors.border }]} />
          <View style={[styles.railLine, styles.railDone, { backgroundColor: theme.colors.primary }]} />
          <View style={styles.railFuseSlot}>
            <View style={[styles.railLine, styles.railFuseTrack, { backgroundColor: theme.colors.border }]} />
            <Animated.View style={[styles.fuse, { width: fillWidth, backgroundColor: fuseColor }]}>
              <View style={[styles.spark, { backgroundColor: isReady ? fuseColor : mint, boxShadow: `0 0 10px 2px ${(isReady ? fuseColor : mint)}aa` }]} />
            </Animated.View>
          </View>
        </View>

        {STAGES.map((stageKey, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;
          const stageColor = theme.colors.primary;
          return (
            <View key={stageKey} style={styles.stop}>
              <View style={styles.nodeSlot}>
                {isActive && (stageKey === "confirmed" || stageKey === "preparing") ? (
                  <Animated.View style={[styles.ring, { borderColor: stageColor, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
                ) : null}
                <View
                  style={[
                    styles.node,
                    { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                    isDone && { backgroundColor: stageColor, borderColor: stageColor },
                    isActive && { borderColor: stageColor, borderWidth: 2.5, backgroundColor: isReady ? stageColor : theme.colors.background },
                  ]}
                >
                  {stageKey === "confirmed" ? (
                    // Активная-но-не-done "Оплачено" (ждём подтверждения заведения) не залита цветом —
                    // такая же небольшая "лунка", что и у "Готовится" до готовности, поэтому и цвет
                    // галочки здесь так же зависит от заливки, а не просто от isDone||isActive
                    // (на залитом узле — светлая, на пустой "лунке" — акцентная, иначе невидима на фоне).
                    <Check size={20} color={isDone ? theme.colors.onPrimary : isActive ? stageColor : theme.colors.textMuted} strokeWidth={3} />
                  ) : stageKey === "preparing" ? (
                    <ChefHat size={20} color={isDone ? theme.colors.onPrimary : isActive ? stageColor : theme.colors.textMuted} strokeWidth={2.1} />
                  ) : (
                    <FryingPanIcon size={22} color={isActive ? theme.colors.onPrimary : theme.colors.textMuted} />
                  )}
                </View>
              </View>
              <Text
                style={[styles.label, { color: isDone || isActive ? theme.colors.text : theme.colors.textMuted, fontWeight: isActive ? "800" : "600" }]}
                numberOfLines={2}
              >
                {t(`orderStatus.${stageKey}`)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.chip, { backgroundColor: chipBg, borderColor: `${fuseColor}55` }]}>
        {isReady || isAccepted ? (
          <>
            <Text style={[theme.fonts.bold, styles.percent, { color: accent }]}>{isReady ? "100%" : `${percent}%`}</Text>
            <View style={[styles.chipDivider, { backgroundColor: `${fuseColor}55` }]} />
          </>
        ) : null}
        <Text style={[theme.typography.bodyBold, styles.hint, { color: theme.colors.text }]}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginVertical: 12 },
  row: { flexDirection: "row", alignItems: "flex-start", width: "100%" },
  // Фитиль лежит под узлами: центры первой и последней остановки — на 1/6 и 5/6 ширины.
  rail: { position: "absolute", left: "16.66%", right: "16.66%", top: NODE / 2 - 1.5, height: 3, flexDirection: "row" },
  railLine: { height: 3, borderRadius: 2, flex: 1 },
  railDone: { position: "absolute", left: 0, top: 0, width: "50%" },
  railFuseSlot: { position: "absolute", left: "50%", right: 0, top: 0, height: 3 },
  railFuseTrack: { position: "absolute", left: 0, right: 0, top: 0 },
  fuse: { height: 3, borderRadius: 2, justifyContent: "center", alignItems: "flex-end" },
  spark: { width: 9, height: 9, borderRadius: 5, marginRight: -4 },
  stop: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  nodeSlot: { width: NODE, height: NODE, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 2 },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12, lineHeight: 15, textAlign: "center", marginTop: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, paddingLeft: 16, paddingRight: 18, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  percent: { fontSize: 14, fontVariant: ["tabular-nums"], minWidth: 44, textAlign: "center" },
  chipDivider: { width: 1, height: 16 },
  hint: { fontSize: 14 },
});
