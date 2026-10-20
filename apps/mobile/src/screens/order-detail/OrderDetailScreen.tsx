import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CircleX from "lucide-react-native/icons/circle-x";
import Hourglass from "lucide-react-native/icons/hourglass";
import { useTheme } from "../../theme/ThemeProvider";
import { useNow } from "../../hooks/useNow";
import { useTicket } from "../../hooks/useTicket";
import { Screen } from "../../components/Screen";
import { OfflineNotice } from "../../components/OfflineNotice";
import { OrderStatusTimeline } from "../../components/OrderStatusTimeline";
import { PickupTicket } from "../../components/PickupTicket";
import { ReceiptCard } from "../../components/ReceiptCard";
import { VenueCard } from "../../components/VenueCard";
import { SupportLink } from "../../components/support/SupportLink";
import { LoadingView, ErrorView } from "../../components/StateViews";
import { OfflineState } from "../../components/kit/EmptyState";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"OrderDetail">;

export function OrderDetailScreen({ route }: Props) {
  const { orderId } = route.params;
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow(15000);
  const ticket = useTicket(orderId);
  const { order, offer, qrCodeDataUrl } = ticket;

  if (ticket.status === "error") {
    return (
      <Screen>
        {ticket.networkError ? <OfflineState onRetry={ticket.reload} /> : <ErrorView label={ticket.error ?? t("common.error")} onRetry={ticket.reload} />}
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

  // Сохранённая копия сама не узнает, что окно выдачи закрылось (статус EXPIRED выставляет сервер): без сети считаем это по времени,
  // иначе человек увидел бы «ожидает самовывоза» и действующий код у билета, которым уже нельзя воспользоваться.
  const windowOver = ticket.offline && !!offer && now >= new Date(offer.pickupEnd).getTime();
  const status = order.status === "CONFIRMED" && windowOver ? "EXPIRED" : order.status;

  const note = (Icon: typeof CircleCheck, color: string, text: string) => (
    <View style={[styles.note, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Icon size={20} color={color} strokeWidth={2.2} />
      <Text style={[theme.typography.body, styles.noteText, { color: theme.colors.text }]}>{text}</Text>
    </View>
  );

  return (
    <Screen scroll ambient>
      {ticket.offline ? <OfflineNotice kind={windowOver ? "ticketExpired" : "ticket"} savedAt={ticket.savedAt} onRetry={ticket.reload} /> : null}

      {offer ? (
        <Text accessibilityRole="header" style={[theme.typography.h1, { color: theme.colors.text }]}>
          {offer.title}
        </Text>
      ) : null}
      <Text style={offer ? [theme.fonts.heavy, styles.amount, { color: theme.colors.primary }] : [theme.typography.h1, { color: theme.colors.text }]}>
        {(order.totalPrice / 100).toFixed(0)} ₽ · x{order.quantity}
      </Text>

      {status === "CONFIRMED" && offer ? (
        <OrderStatusTimeline pickupStart={offer.pickupStart} pickupEnd={offer.pickupEnd} acceptedAt={order.acceptedAt} />
      ) : (
        <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 4 }]}>{t(`orders.status.${status}`)}</Text>
      )}

      {status === "CONFIRMED" && qrCodeDataUrl && offer ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <PickupTicket
            ready={now >= new Date(offer.pickupStart).getTime()}
            qrCodeDataUrl={qrCodeDataUrl}
            pickupCode={order.pickupCode}
            codeLabel={t("orderDetail.pickupCodeLabel")}
          />
        </View>
      ) : null}

      {status === "COMPLETED" ? <ReceiptCard order={order} onUpdated={ticket.applyOrder} /> : null}

      <VenueCard
        state={ticket.venueState}
        onRetry={ticket.reload}
        pickupStart={offer?.pickupStart}
        pickupEnd={offer?.pickupEnd}
        withRoute={status === "CONFIRMED"}
      />

      <SupportLink
        order={{
          id: order.id,
          title: offer?.title,
          venue: ticket.venue?.name,
          totalPrice: order.totalPrice,
          createdAt: order.createdAt,
        }}
      />

      {status === "COMPLETED" ? <View style={{ marginTop: theme.spacing.lg }}>{note(CircleCheck, theme.colors.success, t("orderDetail.statusCompletedNote"))}</View> : null}
      {status === "EXPIRED" ? <View style={{ marginTop: theme.spacing.lg }}>{note(Hourglass, theme.colors.warning, t("orderDetail.statusExpiredNote"))}</View> : null}
      {status === "CANCELLED" ? <View style={{ marginTop: theme.spacing.lg }}>{note(CircleX, theme.colors.textMuted, t("orderDetail.statusCancelledNote"))}</View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, borderWidth: 1 },
  noteText: { flex: 1 },
  amount: { fontSize: 20, letterSpacing: -0.4, marginTop: 2 },
});
