import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Offer } from "@apetite/shared";
import { offersApi } from "../../api/offers";
import { useTheme } from "../../theme/ThemeProvider";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { LoadingView, ErrorView } from "../../components/StateViews";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"OfferDetail">;

export function OfferDetailScreen({ route, navigation }: Props) {
  const { offerId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    offersApi
      .get(offerId)
      .then((data) => {
        if (!cancelled) setOffer(data);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : t("offerDetail.notFound"));
      });
    return () => {
      cancelled = true;
    };
  }, [offerId, t]);

  if (error) {
    return (
      <Screen>
        <ErrorView label={error} />
      </Screen>
    );
  }

  if (!offer) {
    return (
      <Screen>
        <LoadingView label={t("common.loading")} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={[theme.typography.h1, { color: theme.colors.text }]}>{offer.title}</Text>
      {offer.description ? (
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: theme.spacing.sm }]}>
          {offer.description}
        </Text>
      ) : null}

      <View style={[styles.priceRow, { marginTop: theme.spacing.lg }]}>
        <Text style={[theme.typography.h2, { color: theme.colors.primary }]}>
          {(offer.discountedPrice / 100).toFixed(0)} ₽
        </Text>
        <Text style={[styles.originalPrice, { color: theme.colors.textMuted }]}>
          {(offer.originalPrice / 100).toFixed(0)} ₽
        </Text>
        <View style={[styles.badge, { backgroundColor: theme.colors.primary, borderRadius: theme.radii.full }]}>
          <Text style={[styles.badgeText, { color: theme.colors.onPrimary }]}>-{offer.discountPercent}%</Text>
        </View>
      </View>

      <Text style={[theme.typography.body, { color: theme.colors.text, marginTop: theme.spacing.md }]}>
        {t("offerDetail.left", { count: offer.quantityLeft })}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
        {t("offerDetail.pickupWindow")}:{" "}
        {new Date(offer.pickupStart).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}–
        {new Date(offer.pickupEnd).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
      </Text>

      <View style={{ marginTop: theme.spacing.xl }}>
        <Button title={t("offerDetail.buy")} onPress={() => navigation.navigate("Checkout", { offerId })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  originalPrice: { fontSize: 16, textDecorationLine: "line-through" },
  badge: { paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },
});
