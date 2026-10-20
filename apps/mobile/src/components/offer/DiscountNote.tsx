import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import TrendingUp from "lucide-react-native/icons/trending-up";
import Lock from "lucide-react-native/icons/lock";
import { DiscountMode, nextDiscountStep, type Offer } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";

/**
 * Одна строка о том, как поведёт себя цена: у «растущего» оффера — до скольких процентов и примерно когда вырастет скидка
 * (шедулер пересчитывает раз в 15 минут, поэтому «около»), у фиксированного — что цена не изменится. Покупатель решает
 * «брать сейчас или подождать» на фактах, без давления. Ничего не показываем, если расти уже нечему.
 */
export function DiscountNote({ offer, now, locale }: { offer: Pick<Offer, "discountMode" | "baseDiscountPercent" | "pickupEnd">; now: number; locale: string }) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (offer.discountMode === DiscountMode.FIXED) {
    return (
      <View style={styles.row} accessibilityRole="text">
        <Lock size={14} color={theme.colors.textMuted} strokeWidth={2.2} />
        <Text style={[styles.text, { color: theme.colors.textMuted }]}>{t("offerDetail.discountFixed")}</Text>
      </View>
    );
  }
  const next = nextDiscountStep(offer.discountMode, offer.baseDiscountPercent, offer.pickupEnd, now);
  if (!next) return null;
  const time = next.at.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return (
    <View style={styles.row} accessibilityRole="text">
      <TrendingUp size={14} color={theme.colors.primary} strokeWidth={2.2} />
      <Text style={[styles.text, { color: theme.colors.textMuted }]}>{t("offerDetail.discountGrows", { percent: next.percent, time })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  text: { fontSize: 13, flexShrink: 1 },
});
