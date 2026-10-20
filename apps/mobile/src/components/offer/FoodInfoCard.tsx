import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import FlaskConical from "lucide-react-native/icons/flask-conical";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import CalendarClock from "lucide-react-native/icons/calendar-clock";
import type { Offer } from "@apetite/shared";
import { useTheme } from "../../theme/ThemeProvider";
import { foodInfoStatus, formatBestBefore } from "../../utils/foodInfo";
import { InfoCard } from "./InfoCard";

type FoodOffer = Pick<Offer, "category" | "ingredients" | "allergens" | "allergensDeclared" | "bestBefore">;

/**
 * Состав, аллергены и срок годности — до оплаты (закон о защите прав потребителей), поэтому блок стоит на экране оффера
 * выше «времени на самовывоз», а не в конце страницы. У старых офферов, где заведение ничего не указало, мы не делаем вид,
 * что аллергенов нет, а прямо просим уточнить у заведения. Для цветов блока нет.
 */
export function FoodInfoCard({ offer }: { offer: FoodOffer }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const status = foodInfoStatus(offer);
  if (status === "none") return null;
  const locale = i18n.language === "en" ? "en-GB" : "ru-RU";
  const allergens = offer.allergens ?? [];

  return (
    <InfoCard icon={<FlaskConical size={15} color={theme.colors.textMuted} strokeWidth={2.2} />} title={t("foodInfo.title")}>
      {status === "missing" ? (
        <View style={styles.missing}>
          <TriangleAlert size={18} color={theme.colors.warning} strokeWidth={2.2} style={styles.icon} />
          <Text style={[styles.body, { color: theme.colors.text }]}>{t("foodInfo.missing")}</Text>
        </View>
      ) : (
        <>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>{t("foodInfo.ingredients")}</Text>
          <Text style={[styles.body, { color: theme.colors.text }]}>{offer.ingredients}</Text>

          <Text style={[styles.label, styles.gap, { color: theme.colors.textMuted }]}>{t("foodInfo.allergens")}</Text>
          {allergens.length > 0 ? (
            <View style={styles.chips} accessibilityLabel={`${t("foodInfo.allergens")}: ${allergens.map((code) => t(`allergens.${code}`)).join(", ")}`} accessible>
              {allergens.map((code) => (
                <View key={code} style={[styles.chip, { backgroundColor: theme.colors.warningSoft }]}>
                  <Text style={[styles.chipText, { color: theme.colors.warning }]}>{t(`allergens.${code}`)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.body, { color: theme.colors.text }]}>{t("foodInfo.noAllergens")}</Text>
          )}

          <View style={[styles.when, styles.gap]}>
            <CalendarClock size={15} color={theme.colors.textMuted} strokeWidth={2.2} />
            <Text style={[styles.whenText, { color: theme.colors.text }]}>{t("foodInfo.bestBefore", { date: formatBestBefore(offer.bestBefore as string, locale) })}</Text>
          </View>
        </>
      )}
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  body: { fontSize: 14.5, lineHeight: 21, marginTop: 2, flexShrink: 1 },
  gap: { marginTop: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: "700" },
  when: { flexDirection: "row", alignItems: "center", gap: 8 },
  whenText: { fontSize: 14, fontWeight: "600" },
  missing: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  icon: { marginTop: 2 },
});
