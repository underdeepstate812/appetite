import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Store, Flame } from "lucide-react-native";
import type { NearbyOffer } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";
import { useNow } from "../hooks/useNow";
import { getTimeLeft, getUrgencyRatio } from "../utils/time";

/**
 * Две статы поверх карты, как в брифе ("Кафе рядом: 3" / "Рестораны: 5") — но
 * честные к реальной модели данных: в схеме нет разделения на "кафе" vs
 * "рестораны" (см. OfferCategory — FOOD/BAKERY/FLOWERS/GROCERIES), поэтому
 * показываем то, что реально можно посчитать: число уникальных заведений и
 * число "горящих" (urgency ≥ 0.55) предложений рядом.
 */
export function MapPreviewChips({ offers }: { offers: NearbyOffer[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow();

  const venueCount = new Set(offers.map((offer) => offer.businessName)).size;
  const hotCount = offers.filter((offer) => getUrgencyRatio(getTimeLeft(offer.pickupEnd, now)) >= 0.55).length;

  return (
    <View style={styles.row} pointerEvents="none">
      <Chip icon={<Store size={13} color={theme.colors.text} strokeWidth={2.2} />} label={t("home.chipVenuesNearby", { count: venueCount })} bg={theme.colors.surfaceElevated} textColor={theme.colors.text} />
      {hotCount > 0 ? (
        // danger (красный), не primary — "горящие" предложения это urgency,
        // не бренд-акцент (см. тот же принцип в OfferCard.featuredEyebrow).
        <Chip
          icon={<Flame size={13} color="#FFFFFF" strokeWidth={2.2} />}
          label={t("home.chipHotDeals", { count: hotCount })}
          bg={theme.colors.danger}
          textColor="#FFFFFF"
        />
      ) : null}
    </View>
  );
}

function Chip({ icon, label, bg, textColor }: { icon: React.ReactNode; label: string; bg: string; textColor: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon}
      <Text style={[styles.chipText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: "absolute", left: 10, right: 10, bottom: 10, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
});
