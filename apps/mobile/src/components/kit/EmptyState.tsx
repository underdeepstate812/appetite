import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import WifiOff from "lucide-react-native/icons/wifi-off";
import { useTheme } from "../../theme/ThemeProvider";
import { glassTokens, type GlassTone } from "../../theme/glass";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { Button } from "../Button";

interface EmptyStateProps {
  /** Значок в стеклянном ореоле; получает акцентный цвет тона. */
  icon: (color: string) => React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  /** mint — спокойное «пока пусто», ember — «что-то не так» (нет связи). */
  tone?: Extract<GlassTone, "mint" | "ember">;
}

/**
 * Пустое состояние: значок в стеклянном ореоле с медленно расходящимся кольцом, заголовок, пояснение и одно действие.
 * Решение по мотивам Empty и Offline Empty State (21st.dev: иконка + заголовок + описание + кнопка повтора) — вместо
 * одной серой строки посреди экрана. Появляется мягко (прозрачность + сдвиг), при reduced-motion — сразу.
 */
export function EmptyState({ icon, title, description, action, tone = "mint" }: EmptyStateProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const g = glassTokens(theme.mode, tone);
  const dark = theme.mode === "dark";
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    Animated.timing(enter, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [enter, ring, reduced]);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Animated.View style={[styles.wrap, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      <View style={styles.haloSlot}>
        {!reduced ? <Animated.View style={[styles.ring, { borderColor: g.accent, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} /> : null}
        <View
          style={[
            styles.halo,
            {
              backgroundColor: tone === "ember" ? theme.colors.emberSoft : theme.colors.primarySoft,
              borderColor: g.border,
              boxShadow: dark ? `inset 0 1px 0 ${g.sheen}, 0 0 32px ${g.accent}40` : `inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 26px ${g.accent}30`,
            },
          ]}
        >
          {icon(g.accent)}
        </View>
      </View>
      <Text accessibilityRole="header" style={[theme.typography.h2, styles.title, { color: theme.colors.text }]}>
        {title}
      </Text>
      {description ? <Text style={[styles.description, { color: theme.colors.textMuted }]}>{description}</Text> : null}
      {action ? (
        <View style={styles.action}>
          <Button title={action.label} onPress={action.onPress} variant={tone === "ember" ? "secondary" : "primary"} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Нет связи: то же состояние, но тоном «внимание» и со значком перечёркнутой сети. Тексты — из i18n. */
export function OfflineState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      tone="ember"
      icon={(color) => <WifiOff size={30} color={color} strokeWidth={2.1} />}
      title={t("states.offlineTitle")}
      description={t("states.offlineHint")}
      action={{ label: t("common.retry"), onPress: onRetry }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: 28, paddingVertical: 32, maxWidth: 420, alignSelf: "center" },
  haloSlot: { width: 92, height: 92, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  ring: { position: "absolute", width: 76, height: 76, borderRadius: 38, borderWidth: 1.5 },
  halo: { width: 76, height: 76, borderRadius: 38, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { textAlign: "center" },
  description: { fontSize: 14.5, lineHeight: 21, textAlign: "center", marginTop: 8 },
  action: { alignSelf: "stretch", marginTop: 22 },
});
