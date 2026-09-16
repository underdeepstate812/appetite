import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Offer } from "@apetite/shared";
import { offersApi } from "../../api/offers";
import { ordersApi } from "../../api/orders";
import { useTheme } from "../../theme/ThemeProvider";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { CookingLoader } from "../../components/icons/CookingLoader";
import { PaymentMethodSelector, type PaymentMethod } from "../../components/PaymentMethodSelector";
import { LoadingView, ErrorView } from "../../components/StateViews";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"Checkout">;

/** Количество фиксировано в 1 (как "сюрприз-пакет" в TGTG) — без степпера, проще для беты. */
const QUANTITY = 1;
/**
 * Mock-оплата на backend отвечает почти мгновенно — без искусственной паузы анимация
 * "жарки" просто мигнёт и пользователь её не увидит. Минимальная видимая длительность
 * не эмулирует реальную задержку платежа, а даёт анимации доиграть один цикл.
 */
const MIN_COOKING_MS = 1100;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function CheckoutScreen({ route, navigation }: Props) {
  const { offerId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");

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
      const [order] = await Promise.all([ordersApi.create({ offerId, quantity: QUANTITY }), wait(MIN_COOKING_MS)]);
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

  if (submitting) {
    return (
      <Screen>
        <View style={styles.cookingWrap}>
          <CookingLoader />
          <Text
            style={[theme.typography.h3, { color: theme.colors.text, marginTop: theme.spacing.lg, textAlign: "center" }]}
          >
            {t("checkout.cooking")}
          </Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, marginTop: theme.spacing.xs, textAlign: "center" },
            ]}
          >
            {t("checkout.cookingHint")}
          </Text>
        </View>
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

      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.textMuted, marginTop: theme.spacing.xl, marginBottom: theme.spacing.xs },
        ]}
      >
        {t("checkout.paymentMethodLabel")}
      </Text>
      <PaymentMethodSelector
        value={paymentMethod}
        onChange={setPaymentMethod}
        cardLabel={t("checkout.paymentCard")}
        cardHint={t("checkout.paymentCardHint")}
        sbpLabel={t("checkout.paymentSbp")}
        sbpHint={t("checkout.paymentSbpHint")}
      />

      {submitError ? (
        <Text style={[theme.typography.body, { color: theme.colors.danger, marginTop: theme.spacing.md }]}>
          {submitError}
        </Text>
      ) : null}

      <View style={{ marginTop: theme.spacing.xl }}>
        <Button title={t("checkout.payButton")} onPress={handlePay} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  cookingWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
});
