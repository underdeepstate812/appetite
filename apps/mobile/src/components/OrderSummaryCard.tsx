import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Clock from "lucide-react-native/icons/clock";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import CalendarClock from "lucide-react-native/icons/calendar-clock";
import MapPin from "lucide-react-native/icons/map-pin";
import type { Offer } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";
import { glassTokens } from "../theme/glass";
import { formatPickupWindow } from "../utils/pickup";
import { foodInfoStatus, formatBestBefore } from "../utils/foodInfo";
import type { BusinessState } from "../hooks/useBusiness";
import { Button } from "./Button";
import { GlassCard } from "./glass/GlassCard";

interface OrderSummaryCardProps {
  offer: Offer;
  quantity: number;
  venue: BusinessState;
  onRetryVenue: () => void;
}

/**
 * Сводка перед оплатой — «чек» из трёх частей: что берём, где и когда забирать, сколько платим.
 * Раньше здесь были только название, «1» и сумма: человек платил, не видя адреса и времени выдачи.
 */
export function OrderSummaryCard({ offer, quantity, venue, onRetryVenue }: OrderSummaryCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const accent = glassTokens(theme.mode, "mint").accent;
  const locale = i18n.language === "en" ? "en-GB" : "ru-RU";
  const window = formatPickupWindow(offer.pickupStart, offer.pickupEnd, { tomorrow: t("offerDetail.tomorrow"), locale });
  const business = venue.status === "ready" ? venue.business : null;
  const food = foodInfoStatus(offer);
  const allergens = (offer.allergens ?? []).map((code) => t(`allergens.${code}`));

  return (
    <GlassCard tone="mint" style={styles.card} accessibilityLabel={t("checkout.summary")}>
      <Text style={[theme.typography.bodyBold, styles.title, { color: theme.colors.text }]}>{offer.title}</Text>

      <View style={styles.line}>
        <MapPin size={15} color={accent} strokeWidth={2.4} />
        {business ? (
          <Text style={[styles.lineText, { color: theme.colors.text }]}>
            <Text style={styles.strong}>{business.name}</Text>
            <Text style={{ color: theme.colors.textMuted }}>{` · ${business.address}`}</Text>
          </Text>
        ) : venue.status === "loading" ? (
          <Text style={[styles.lineText, { color: theme.colors.textMuted }]}>{t("common.loading")}</Text>
        ) : (
          <View style={styles.retryRow}>
            <Text style={[styles.lineText, { color: theme.colors.textMuted }]}>{t("venue.unavailable")}</Text>
            <Button title={t("common.retry")} variant="ghost" size="sm" onPress={onRetryVenue} />
          </View>
        )}
      </View>

      <View style={styles.line}>
        <Clock size={15} color={accent} strokeWidth={2.4} />
        <Text style={[styles.lineText, { color: theme.colors.text }]}>{t("venue.when", { range: window })}</Text>
      </View>

      {/* Аллергены и срок годности — прямо перед оплатой: короткая выжимка (полный состав — на экране предложения). */}
      {food === "complete" ? (
        <>
          <View style={styles.line}>
            <TriangleAlert size={15} color={theme.colors.warning} strokeWidth={2.4} />
            <Text style={[styles.lineText, { color: theme.colors.text }]}>
              {allergens.length > 0 ? t("foodInfo.summaryAllergens", { list: allergens.join(", ") }) : t("foodInfo.summaryNoAllergens")}
            </Text>
          </View>
          <View style={styles.line}>
            <CalendarClock size={15} color={accent} strokeWidth={2.4} />
            <Text style={[styles.lineText, { color: theme.colors.text }]}>{t("foodInfo.summaryBestBefore", { date: formatBestBefore(offer.bestBefore as string, locale) })}</Text>
          </View>
        </>
      ) : food === "missing" ? (
        <View style={styles.line}>
          <TriangleAlert size={15} color={theme.colors.warning} strokeWidth={2.4} />
          <Text style={[styles.lineText, { color: theme.colors.text }]}>{t("foodInfo.summaryMissing")}</Text>
        </View>
      ) : null}

      {/* «Перфорация» чека: отделяет то, что берём, от суммы. */}
      <View style={[styles.perforation, { borderColor: theme.colors.border }]} />

      <View style={styles.row}>
        <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>{t("checkout.quantityLabel")}</Text>
        <Text style={[theme.typography.body, { color: theme.colors.text }]}>{quantity}</Text>
      </View>
      <View style={styles.row}>
        <Text style={[theme.typography.bodyBold, { color: theme.colors.text }]}>{t("checkout.totalLabel")}</Text>
        <Text style={[theme.fonts.heavy, styles.total, { color: theme.colors.primary }]}>{((offer.discountedPrice * quantity) / 100).toFixed(0)} ₽</Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18 },
  title: { fontSize: 17, lineHeight: 22 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10 },
  lineText: { flex: 1, fontSize: 14, lineHeight: 20 },
  strong: { fontWeight: "700" },
  retryRow: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  perforation: { borderTopWidth: 1.5, borderStyle: "dashed", marginTop: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  total: { fontSize: 20, letterSpacing: -0.4 },
});
