import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CircleX from "lucide-react-native/icons/circle-x";
import Hourglass from "lucide-react-native/icons/hourglass";
import type { Offer, Order } from "@apetite/shared";
import { ordersApi } from "../../api/orders";
import { offersApi } from "../../api/offers";
import { useTheme } from "../../theme/ThemeProvider";
import { useNow } from "../../hooks/useNow";
import { Screen } from "../../components/Screen";
import { OrderStatusTimeline } from "../../components/OrderStatusTimeline";
import { PickupTicket } from "../../components/PickupTicket";
import { LoadingView, ErrorView } from "../../components/StateViews";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"OrderDetail">;

export function OrderDetailScreen({ route }: Props) {
  const { orderId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow(15000);
  const [order, setOrder] = useState<Order | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
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

  if (error) {
    return (
      <Screen>
        <ErrorView label={error} onRetry={() => void load()} />
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

  const note = (Icon: typeof CircleCheck, color: string, text: string) => (
    <View style={[styles.note, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Icon size={20} color={color} strokeWidth={2.2} />
      <Text style={[theme.typography.body, styles.noteText, { color: theme.colors.text }]}>{text}</Text>
    </View>
  );

  return (
    <Screen scroll>
      <Text style={[theme.typography.h1, { color: theme.colors.text }]}>
        {(order.totalPrice / 100).toFixed(0)} ₽ · x{order.quantity}
      </Text>

      {order.status === "CONFIRMED" && offer ? (
        <OrderStatusTimeline pickupStart={offer.pickupStart} pickupEnd={offer.pickupEnd} acceptedAt={order.acceptedAt} />
      ) : (
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 4 }]}>{t(`orders.status.${order.status}`)}</Text>
      )}

      {order.status === "CONFIRMED" && qrCodeDataUrl && offer ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <PickupTicket
            ready={now >= new Date(offer.pickupStart).getTime()}
            qrCodeDataUrl={qrCodeDataUrl}
            pickupCode={order.pickupCode}
            codeLabel={t("orderDetail.pickupCodeLabel")}
          />
        </View>
      ) : null}

      {order.status === "COMPLETED" ? <View style={{ marginTop: theme.spacing.lg }}>{note(CircleCheck, theme.colors.success, t("orderDetail.statusCompletedNote"))}</View> : null}
      {order.status === "EXPIRED" ? <View style={{ marginTop: theme.spacing.lg }}>{note(Hourglass, theme.colors.warning, t("orderDetail.statusExpiredNote"))}</View> : null}
      {order.status === "CANCELLED" ? <View style={{ marginTop: theme.spacing.lg }}>{note(CircleX, theme.colors.textMuted, t("orderDetail.statusCancelledNote"))}</View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, borderWidth: 1 },
  noteText: { flex: 1 },
});
