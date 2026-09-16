import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Offer, Order } from "@apetite/shared";
import { offersApi } from "../../api/offers";
import { ordersApi } from "../../api/orders";
import { useTheme } from "../../theme/ThemeProvider";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { OrderStatusTimeline } from "../../components/OrderStatusTimeline";
import { LoadingView, ErrorView } from "../../components/StateViews";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"OrderConfirmation">;

export function OrderConfirmationScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const [order, setOrder] = useState<Order | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [orderData, qr] = await Promise.all([ordersApi.get(orderId), ordersApi.getQrCode(orderId)]);
        const offerData = await offersApi.get(orderData.offerId);
        if (!cancelled) {
          setOrder(orderData);
          setQrCodeDataUrl(qr.qrCodeDataUrl);
          setOffer(offerData);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : t("common.error"));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId, t]);

  const handleDone = () => {
    // Сбрасываем весь стек (OfferDetail → OrderConfirmation), а не просто "назад" —
    // иначе "назад" с любого следующего экрана вернул бы на уже оплаченный чек-аут.
    navigation.reset({
      index: 0,
      routes: [{ name: "Main", params: { screen: "Orders" } }],
    });
  };

  if (error) {
    return (
      <Screen>
        <ErrorView label={error} />
      </Screen>
    );
  }

  if (!order || !offer || !qrCodeDataUrl) {
    return (
      <Screen>
        <LoadingView label={t("common.loading")} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={[theme.typography.h1, { color: theme.colors.text, textAlign: "center" }]}>
        {t("orderConfirmation.title")}
      </Text>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.textMuted, textAlign: "center", marginTop: theme.spacing.xs },
        ]}
      >
        {t("orderConfirmation.subtitle")}
      </Text>

      <OrderStatusTimeline pickupStart={offer.pickupStart} pickupEnd={offer.pickupEnd} />

      <View style={styles.qrWrapper}>
        <Image source={{ uri: qrCodeDataUrl }} style={styles.qrImage} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }]}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          {t("orderConfirmation.pickupCodeLabel")}
        </Text>
        <Text style={[styles.pickupCode, { color: theme.colors.text }]}>{order.pickupCode}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: theme.spacing.sm }]}>
          {t("orderConfirmation.pickupWindowLabel")}:{" "}
          {new Date(offer.pickupEnd).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>

      <View style={{ marginTop: theme.spacing.xl }}>
        <Button title={t("orderConfirmation.doneButton")} onPress={handleDone} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrWrapper: { alignItems: "center", marginVertical: 24 },
  qrImage: { width: 220, height: 220 },
  card: { padding: 16, alignItems: "center" },
  pickupCode: { fontSize: 32, fontWeight: "800", letterSpacing: 4, marginTop: 4 },
});
