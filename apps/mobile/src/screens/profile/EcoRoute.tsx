import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Check from "lucide-react-native/icons/check";
import Earth from "lucide-react-native/icons/earth";
import Package from "lucide-react-native/icons/package";
import Sprout from "lucide-react-native/icons/sprout";
import Trophy from "lucide-react-native/icons/trophy";
import { ECO_LEVELS, type EcoSummary } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { useReducedMotion } from "../../hooks/useReducedMotion";

// Векторные значки вместо эмодзи из ECO_LEVELS (🌱🥡🌍🏆) — по id уровня.
const LEVEL_ICON = { 1: Sprout, 2: Package, 3: Earth, 4: Trophy } as const;
const NODE = 38;

/**
 * Уровни эко-профиля как маршрут из четырёх остановок (тот же образ "маршрута", что и в
 * разделе "Как это работает" на сайте). Между остановками — фитиль: он догорает до текущего
 * прогресса, цвет линии "нагревается" от мяты к янтарю, на конце горит искра. Пройденные
 * остановки залиты и с галочкой, текущая пульсирует, дальше — пустые кружки.
 */
export function EcoRoute({ summary }: { summary: EcoSummary }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const { level, nextLevel, totalPoints } = summary;

  const currentIndex = Math.max(0, ECO_LEVELS.findIndex((item) => item.id === level.id));
  const stepProgress = nextLevel
    ? Math.min(1, Math.max(0, (totalPoints - level.minPoints) / (nextLevel.minPoints - level.minPoints)))
    : 0;
  const routeProgress = nextLevel ? (currentIndex + stepProgress) / (ECO_LEVELS.length - 1) : 1;
  // Прогресс красится брендом, а не жаром (жар — только про оставшееся время); на конце — мятная искра.
  const fuseColor = theme.colors.primary;
  const head = theme.mode === "dark" ? "#b8fbef" : "#0f766e";

  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: routeProgress, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [routeProgress, fill]);
  const fillWidth = fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.overline, { color: theme.colors.textMuted }]}>{t("profile.routeTitle").toUpperCase()}</Text>

      <View style={styles.route}>
        <View style={[styles.track, { backgroundColor: theme.colors.border }]}>
          <Animated.View style={[styles.fill, { width: fillWidth, backgroundColor: fuseColor }]}>
            <View style={[styles.spark, { backgroundColor: head, boxShadow: `0 0 10px 3px ${head}aa` }]} />
          </Animated.View>
        </View>

        {ECO_LEVELS.map((item, index) => {
          const reached = index < currentIndex || (index === currentIndex && !nextLevel);
          const current = index === currentIndex && !!nextLevel;
          const Icon = LEVEL_ICON[item.id as keyof typeof LEVEL_ICON];
          return (
            <View key={item.id} style={styles.stop}>
              <View style={styles.nodeSlot}>
                {current ? (
                  <Animated.View style={[styles.ring, { borderColor: theme.colors.primary, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
                ) : null}
                <View
                  style={[
                    styles.node,
                    reached && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                    current && { backgroundColor: theme.colors.background, borderColor: theme.colors.primary, borderWidth: 2.5 },
                    !reached && !current && { backgroundColor: theme.colors.background, borderColor: theme.colors.textMuted, borderStyle: "dashed", opacity: 0.85 },
                  ]}
                >
                  {reached ? (
                    <Check size={17} color={theme.colors.onPrimary} strokeWidth={3} />
                  ) : (
                    <Icon size={17} color={current ? theme.colors.primary : theme.colors.textMuted} strokeWidth={2.1} />
                  )}
                </View>
              </View>
              <Text style={[styles.label, { color: current ? theme.colors.text : theme.colors.textMuted, fontWeight: current ? "800" : "600" }]} numberOfLines={2}>
                {t(`eco.levelNames.${item.id}`)}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, textAlign: "center" }]}>
        {nextLevel ? t("eco.nextLevelProgress", { points: Math.max(0, nextLevel.minPoints - totalPoints) }) : t("eco.maxLevelReached")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 12, paddingTop: 18, paddingBottom: 16 },
  overline: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.3, marginLeft: 8, marginBottom: 16 },
  route: { flexDirection: "row", marginBottom: 14 },
  // Центры первой и последней остановки — на 12.5% и 87.5% ширины: линия идёт ровно между ними.
  track: { position: "absolute", left: "12.5%", right: "12.5%", top: NODE / 2 - 2, height: 4, borderRadius: 2 },
  fill: { height: 4, borderRadius: 2, justifyContent: "center", alignItems: "flex-end" },
  spark: { width: 8, height: 8, borderRadius: 4, marginRight: -4 },
  stop: { flex: 1, alignItems: "center", paddingHorizontal: 2 },
  nodeSlot: { width: NODE, height: NODE, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 2 },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, lineHeight: 14, textAlign: "center", marginTop: 8 },
});
