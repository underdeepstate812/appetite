import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Offer, Order } from "@apetite/shared";
import { offersApi } from "../../api/offers";
import { ordersApi } from "../../api/orders";
import { useTheme } from "../../theme/ThemeProvider";
import { useNow } from "../../hooks/useNow";
import { playHaptic } from "../../utils/haptics";
import { hasCelebrated, markCelebrated } from "../../utils/celebration";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { AcceptedBadge } from "../../components/AcceptedBadge";
import { OrderStatusTimeline } from "../../components/OrderStatusTimeline";
import { PickupTicket } from "../../components/PickupTicket";
import { LoadingView, ErrorView } from "../../components/StateViews";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"OrderConfirmation">;

export function OrderConfirmationScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow(15000);
  const [order, setOrder] = useState<Order | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  // Праздник один раз на заказ: при повторном заходе билет просто показывается, без "печати".
  const celebrate = useRef(!hasCelebrated(orderId)).current;

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

  // Заказ принят: "успешно", затем три тика в такт клавишам PIN и мягкое "осело" (см. HAPTIC_SCORES.accepted).
  const ready = !!order && !!offer && !!qrCodeDataUrl;
  useEffect(() => {
    if (!ready || !celebrate || hasCelebrated(orderId)) return;
    markCelebrated(orderId);
    playHaptic(reducedMotion ? "success" : "accepted");
  }, [ready, celebrate, orderId, reducedMotion]);

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

  const windowOpen = now >= new Date(offer.pickupStart).getTime();
  const endLabel = new Date(offer.pickupEnd).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  return (
    <Screen scroll>
      <View style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.md }}>
        <AcceptedBadge />
      </View>
      <Text style={[theme.typography.h1, { color: theme.colors.text, textAlign: "center" }]}>{t("orderConfirmation.title")}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textMuted, textAlign: "center", marginTop: theme.spacing.xs }]}>
        {t("orderConfirmation.subtitle")}
      </Text>

      <OrderStatusTimeline pickupStart={offer.pickupStart} pickupEnd={offer.pickupEnd} acceptedAt={order.acceptedAt} />

      <View style={{ marginTop: theme.spacing.sm }}>
        <PickupTicket
          entrance={celebrate}
          ready={windowOpen}
          qrCodeDataUrl={qrCodeDataUrl}
          pickupCode={order.pickupCode}
          codeLabel={t("orderConfirmation.pickupCodeLabel")}
          footnote={`${t("orderConfirmation.pickupWindowLabel")}: ${endLabel}`}
        />
      </View>

      <View style={{ marginTop: theme.spacing.xl }}>
        <Button title={t("orderConfirmation.doneButton")} onPress={handleDone} />
      </View>
    </Screen>
  );
}
