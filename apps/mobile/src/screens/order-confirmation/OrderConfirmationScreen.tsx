import React, { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
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
import { VenueCard } from "../../components/VenueCard";
import { SupportLink } from "../../components/support/SupportLink";
import { OfflineNotice } from "../../components/OfflineNotice";
import { useTicket } from "../../hooks/useTicket";
import { LoadingView, ErrorView } from "../../components/StateViews";
import { OfflineState } from "../../components/kit/EmptyState";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"OrderConfirmation">;

export function OrderConfirmationScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow(15000);
  const ticket = useTicket(orderId);
  const { order, offer, qrCodeDataUrl } = ticket;
  const reducedMotion = useReducedMotion();
  // Праздник один раз на заказ: при повторном заходе билет просто показывается, без "печати".
  const celebrate = useRef(!hasCelebrated(orderId)).current;

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

  if (ticket.status === "error") {
    return (
      <Screen>
        {ticket.networkError ? <OfflineState onRetry={ticket.reload} /> : <ErrorView label={ticket.error ?? t("common.error")} onRetry={ticket.reload} />}
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
    <Screen scroll ambient>
      {ticket.offline ? <OfflineNotice kind="ticket" savedAt={ticket.savedAt} onRetry={ticket.reload} /> : null}
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

      <VenueCard state={ticket.venueState} onRetry={ticket.reload} pickupStart={offer.pickupStart} pickupEnd={offer.pickupEnd} />

      <SupportLink
        order={{
          id: order.id,
          title: offer.title,
          venue: ticket.venue?.name,
          totalPrice: order.totalPrice,
          createdAt: order.createdAt,
        }}
      />

      <View style={{ marginTop: theme.spacing.xl }}>
        <Button title={t("orderConfirmation.doneButton")} onPress={handleDone} arrow />
      </View>
    </Screen>
  );
}
