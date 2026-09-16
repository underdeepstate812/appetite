import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import type { LocationPermissionStatus } from "../hooks/useLocation";

interface LocationPermissionBannerProps {
  status: LocationPermissionStatus;
  onRequest: () => void;
  onOpenSettings: () => void;
}

/**
 * Две степени серьёзности — разный цвет, не только текст:
 * "denied" ещё можно исправить одним тапом (мягкий warning-тон), "blocked" требует
 * похода в системные настройки (более тревожный danger-тон) — цветовая иерархия
 * помогает считать серьёзность состояния быстрее, чем чтение текста.
 */
export function LocationPermissionBanner({ status, onRequest, onOpenSettings }: LocationPermissionBannerProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (status === "granted") return null;

  const blocked = status === "blocked";
  const tint = blocked ? theme.colors.danger : theme.colors.warning;
  const soft = blocked ? theme.colors.dangerSoft : theme.colors.warningSoft;

  return (
    <View style={[styles.card, { backgroundColor: soft, borderRadius: theme.radii.md }]}>
      <View style={styles.row}>
        <Text style={styles.icon}>{blocked ? "🚫" : "📍"}</Text>
        <Text style={[theme.typography.caption, styles.message, { color: theme.colors.text }]}>
          {blocked ? t("location.blockedMessage") : t("location.rationaleMessage")}
        </Text>
      </View>
      <Pressable
        onPress={blocked ? onOpenSettings : onRequest}
        style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
        hitSlop={4}
      >
        <Text style={[theme.typography.bodyBold, { color: tint }]}>
          {blocked ? t("location.openSettings") : t("location.enable")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  icon: { fontSize: 16, marginRight: 8, marginTop: 1 },
  message: { flex: 1, lineHeight: 18 },
  // minHeight 44 — минимальный touch-таргет (Fitts' law / iOS HIG).
  button: { marginTop: 8, minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
});
