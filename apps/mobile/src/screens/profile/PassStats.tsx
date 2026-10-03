import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { EcoSummary } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { useCountUp } from "../../hooks/useCountUp";

function Stat({ value, decimals, label, color, divider }: { value: number | null; decimals: number; label: string; color: string; divider: boolean }) {
  const theme = useTheme();
  const shown = useCountUp(value ?? 0);

  return (
    <View style={[styles.cell, divider && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border }]}>
      <Text style={[theme.fonts.heavy, styles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value === null ? "—" : shown.toFixed(decimals)}
      </Text>
      <Text style={[styles.label, { color: theme.colors.textMuted }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/** Три числа на корешке — крупно, display-гарнитурой, с "набеганием" от нуля; пока эко-данные не пришли, держим место "—". */
export function PassStats({ eco }: { eco: EcoSummary | null }) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Stat value={eco ? eco.totalPoints : null} decimals={0} label={t("profile.statPoints")} color={theme.colors.primary} divider={false} />
      <Stat value={eco ? eco.totalWeightSavedKg : null} decimals={1} label={t("profile.statKg")} color={theme.colors.text} divider />
      <Stat value={eco ? eco.ordersCompleted : null} decimals={0} label={t("profile.statOrders")} color={theme.colors.text} divider />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingBottom: 18 },
  cell: { flex: 1, paddingHorizontal: 10, alignItems: "flex-start" },
  value: { fontSize: 24, lineHeight: 30, letterSpacing: -0.6, fontVariant: ["tabular-nums"] },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 1.1, marginTop: 2 },
});
