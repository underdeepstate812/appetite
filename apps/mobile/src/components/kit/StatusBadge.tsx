import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { OrderStatus } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface StatusBadgeProps {
  status: OrderStatus;
  label: string;
}

/**
 * Статус заказа бейджем: тонированная плашка с точкой (Status Badge, 21st.dev) вместо цветного слова.
 * У активного заказа точка «дышит» — это единственный живой элемент в списке, глаз сразу находит, что ждёт выдачи.
 * Цвет — те же тона статусов, что и раньше (бирюза / зелёный / приглушённый / янтарь); красный здесь не используется — он за временем.
 */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  const active = status === "CONFIRMED";

  useEffect(() => {
    if (!active || reduced) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [active, reduced, pulse]);

  const tone = {
    CONFIRMED: { fg: theme.colors.primary, bg: theme.colors.primarySoft },
    COMPLETED: { fg: theme.colors.success, bg: theme.colors.successSoft },
    CANCELLED: { fg: theme.colors.textMuted, bg: theme.colors.surface },
    EXPIRED: { fg: theme.colors.warning, bg: theme.colors.warningSoft },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <View style={styles.dotSlot}>
        {active && !reduced ? (
          <Animated.View
            style={[styles.dotRing, { backgroundColor: tone.fg, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }]}
          />
        ) : null}
        <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      </View>
      <Text style={[styles.label, { color: tone.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingLeft: 8, paddingRight: 10, height: 24, borderRadius: 12 },
  dotSlot: { width: 8, height: 8, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotRing: { position: "absolute", width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
});
