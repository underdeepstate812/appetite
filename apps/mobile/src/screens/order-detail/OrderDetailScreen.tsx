import React, { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Offer, Order } from "@apetite/shared";
import { ordersApi } from "../../api/orders";
import { offersApi } from "../../api/offers";
import { useTheme } from "../../theme/ThemeProvider";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { OrderStatusTimeline } from "../../components/OrderStatusTimeline";
import { LoadingView, ErrorView } from "../../components/StateViews";
import { confirmAction } from "../../utils/confirm";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"OrderDetail">;

export function OrderDetailScreen({ route }: Props) {
  const { orderId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const [order, setOrder] = useState<Order | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await ordersApi.get(orderId);
      setOrder(data);
      if (data.status === "CONFIRMED") {
        const [qr, offerData] = await Promise.all([ordersApi.getQrCode(orderId), offersApi.get(data.offerId)]);
        setQrCodeDataUrl(qr.qrCodeDataUrl);
        setOffer(offerData);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("common.error"));
    }
  }, [orderId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCancel = async () => {
    const confirmed = await confirmAction(
      t("orderDetail.cancelConfirmTitle"),
      t("orderDetail.cancelConfirmMessage"),
      t("orderDetail.cancelConfirmYes"),
      t("orderDetail.cancelConfirmNo")
    );
    if (!confirmed) return;

    setCancelling(true);
    try {
      await ordersApi.cancel(orderId);
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : t("common.error"));
    } finally {
      setCancelling(false);
    }
  };

  if (error) {
    return (
      <Screen>
        <ErrorView label={error} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <LoadingView label={t("common.loading")} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={[theme.typography.h1, { color: theme.colors.text }]}>
        {(order.totalPrice / 100).toFixed(0)} ₽ · x{order.quantity}
      </Text>

      {order.status === "CONFIRMED" && offer ? (
        <OrderStatusTimeline pickupStart={offer.pickupStart} pickupEnd={offer.pickupEnd} />
      ) : (
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 4 }]}>
          {t(`orders.status.${order.status}`)}
        </Text>
      )}

      {order.status === "CONFIRMED" && qrCodeDataUrl ? (
        <>
          <View style={styles.qrWrapper}>
            <Image source={{ uri: qrCodeDataUrl }} style={styles.qrImage} />
          </View>
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }]}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              {t("orderDetail.pickupCodeLabel")}
            </Text>
            <Text style={[styles.pickupCode, { color: theme.colors.text }]}>{order.pickupCode}</Text>
          </View>
          <View style={{ marginTop: theme.spacing.xl }}>
            <Button
              title={t("orderDetail.cancelButton")}
              variant="secondary"
              loading={cancelling}
              onPress={() => void handleCancel()}
            />
          </View>
        </>
      ) : null}

      {order.status === "COMPLETED" ? (
        <Text style={[theme.typography.body, { color: theme.colors.success, marginTop: theme.spacing.lg }]}>
          {t("orderDetail.statusCompletedNote")}
        </Text>
      ) : null}
      {order.status === "EXPIRED" ? (
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: theme.spacing.lg }]}>
          {t("orderDetail.statusExpiredNote")}
        </Text>
      ) : null}
      {order.status === "CANCELLED" ? (
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: theme.spacing.lg }]}>
          {t("orderDetail.statusCancelledNote")}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrWrapper: { alignItems: "center", marginVertical: 24 },
  qrImage: { width: 200, height: 200 },
  card: { padding: 16, alignItems: "center" },
  pickupCode: { fontSize: 28, fontWeight: "800", letterSpacing: 4, marginTop: 4 },
});
