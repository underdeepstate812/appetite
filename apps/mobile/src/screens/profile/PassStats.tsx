import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import type { EcoSummary } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { useCountUp } from "../../hooks/useCountUp";
import { DockIcon } from "../../components/icons/DockIcons";

function Stat({ value, decimals, label, color, divider, glyph }: { value: number | null; decimals: number; label: string; color: string; divider: boolean; glyph: "points" | "eco" | "orders" }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  // На узком экране (320) знак рядом с подписью не помещается — остаётся только искра у баллов.
  const showGlyph = width >= 360 || glyph === "points";
  const shown = useCountUp(value ?? 0);

  return (
    <View style={[styles.cell, divider && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border }]}>
      <Text style={[theme.fonts.heavy, styles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value === null ? "—" : shown.toFixed(decimals)}
      </Text>
      <View style={styles.labelRow}>
        {/* Знак у подписи — из набора иконок дока (тот же язык, у каждого ровно одна «искра»); у баллов — сама искра. */}
        {!showGlyph ? null : glyph === "points" ? (
          <View style={[styles.spark, { backgroundColor: theme.colors.primary }]} />
        ) : (
          <DockIcon name={glyph} size={14} color={theme.colors.textMuted} dot={theme.colors.primary} active={false} />
        )}
        <Text style={[styles.label, { color: theme.colors.textMuted }]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/** Три числа на корешке — крупно, display-гарнитурой, с "набеганием" от нуля; пока эко-данные не пришли, держим место "—". */
export function PassStats({ eco }: { eco: EcoSummary | null }) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Stat value={eco ? eco.totalPoints : null} decimals={0} label={t("profile.statPoints")} color={theme.colors.primary} divider={false} glyph="points" />
      <Stat value={eco ? eco.totalWeightSavedKg : null} decimals={1} label={t("profile.statKg")} color={theme.colors.text} divider glyph="eco" />
      <Stat value={eco ? eco.ordersCompleted : null} decimals={0} label={t("profile.statOrders")} color={theme.colors.text} divider glyph="orders" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingBottom: 18 },
  cell: { flex: 1, paddingHorizontal: 10, alignItems: "flex-start" },
  value: { fontSize: 24, lineHeight: 30, letterSpacing: -0.6, fontVariant: ["tabular-nums"] },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  spark: { width: 7, height: 7, borderRadius: 3.5, marginHorizontal: 4 },
  label: { fontSize: 9.5, fontWeight: "700", letterSpacing: 0.8, flexShrink: 1 },
});
