import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Offer } from "@apetite/shared";
import { offersApi } from "../../api/offers";
import { ordersApi } from "../../api/orders";
import { useTheme } from "../../theme/ThemeProvider";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { LoadingView, ErrorView } from "../../components/StateViews";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"Checkout">;

/** Количество фиксировано в 1 (как "сюрприз-пакет" в TGTG) — без степпера, проще для беты. */
const QUANTITY = 1;

export function CheckoutScreen({ route, navigation }: Props) {
  const { offerId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    offersApi
      .get(offerId)
      .then((data) => {
        if (!cancelled) setOffer(data);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : t("offerDetail.notFound"));
      });
    return () => {
      cancelled = true;
    };
  }, [offerId, t]);

  const handlePay = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const order = await ordersApi.create({ offerId, quantity: QUANTITY });
      // replace — чтобы "назад" с экрана подтверждения не возвращал на форму оплаты.
      navigation.replace("OrderConfirmation", { orderId: order.id });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("checkout.errorGeneric"));
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <Screen>
        <ErrorView label={loadError} />
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
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.lg }]}>
        {t("checkout.title")}
      </Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }]}>
        <Text style={[theme.typography.bodyBold, { color: theme.colors.text }]}>{offer.title}</Text>

        <View style={styles.row}>
          <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>
            {t("checkout.quantityLabel")}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>{QUANTITY}</Text>
        </View>

        <View style={styles.row}>
          <Text style={[theme.typography.bodyBold, { color: theme.colors.text }]}>{t("checkout.totalLabel")}</Text>
          <Text style={[theme.typography.h3, { color: theme.colors.primary }]}>
            {((offer.discountedPrice * QUANTITY) / 100).toFixed(0)} ₽
          </Text>
        </View>
      </View>

      {submitError ? (
        <Text style={[theme.typography.body, { color: theme.colors.danger, marginTop: theme.spacing.md }]}>
          {submitError}
        </Text>
      ) : null}

      <View style={{ marginTop: theme.spacing.xl }}>
        <Button
          title={submitting ? t("checkout.processing") : t("checkout.payButton")}
          onPress={handlePay}
          loading={submitting}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
});
