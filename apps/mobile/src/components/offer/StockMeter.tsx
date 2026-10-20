import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";

/** Остаток в штуках дольками: видно «сколько ещё», а когда почти всё разобрали — предупреждение красным (и словом). */
export function StockMeter({ left, total }: { left: number; total: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const soldOut = left <= 0;
  const low = !soldOut && (left <= 3 || left / Math.max(total, 1) <= 0.25);
  const color = soldOut ? theme.colors.textMuted : low ? theme.colors.danger : theme.colors.primary;
  const label = soldOut ? t("offerDetail.soldOut") : t("offerDetail.stockOf", { left, total });
  // Больше 12 долек нечитаемы — масштабируем: каждая долька = несколько штук.
  const cells = Math.min(Math.max(total, 1), 12);
  const filled = soldOut ? 0 : Math.max(1, Math.round((left / Math.max(total, 1)) * cells));

  return (
    <View>
      <View style={styles.row}>
        <Text style={[theme.fonts.bold, styles.value, { color: theme.colors.text }]}>{label}</Text>
        {low ? <Text style={[styles.warn, { color: theme.colors.danger }]}>{t("offerDetail.stockLow")}</Text> : null}
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: total, now: Math.max(left, 0) }}
        style={styles.cells}
      >
        {Array.from({ length: cells }, (_, index) => (
          <View key={index} style={[styles.cell, { backgroundColor: index < filled ? color : theme.colors.border }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  value: { fontSize: 20, lineHeight: 26 },
  warn: { fontSize: 13, fontWeight: "700" },
  cells: { flexDirection: "row", gap: 4, marginTop: 12 },
  cell: { flex: 1, height: 8, borderRadius: 3 },
});
