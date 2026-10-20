import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Receipt from "lucide-react-native/icons/receipt-text";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CircleX from "lucide-react-native/icons/circle-x";
import Hourglass from "lucide-react-native/icons/hourglass";
import type { Order, OrderStatus } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";
import { StatusBadge } from "./kit/StatusBadge";

const STATUS_COLOR: Record<OrderStatus, "primary" | "success" | "textMuted" | "warning"> = {
  CONFIRMED: "primary",
  COMPLETED: "success",
  CANCELLED: "textMuted",
  EXPIRED: "warning",
};

const STATUS_ICON: Record<OrderStatus, typeof Receipt> = {
  CONFIRMED: Receipt,
  COMPLETED: CircleCheck,
  CANCELLED: CircleX,
  EXPIRED: Hourglass,
};

interface OrderRowProps {
  order: Order;
  /** Название оффера и заведение; пока подгружаются — undefined, строка рисует заглушку, а не прыгает. */
  title?: string;
  venue?: string;
  loading: boolean;
  onPress: (orderId: string) => void;
}

/** Строка списка заказов: ЧТО заказано и ГДЕ — вверху, затем статус и дата. Сумма справа, как на чеке. */
export const OrderRow = React.memo(function OrderRow({ order, title, venue, loading, onPress }: OrderRowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const tone = theme.colors[STATUS_COLOR[order.status]];
  const Icon = STATUS_ICON[order.status];
  const active = order.status === "CONFIRMED";
  const dark = theme.mode === "dark";
  const date = new Date(order.createdAt).toLocaleString(i18n.language === "en" ? "en-GB" : "ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const heading = title ?? t("orders.untitled");
  // Выдан, но покупатель ещё не ответил — напоминаем в списке, чтобы не потерять.
  const needsReceipt = order.status === "COMPLETED" && !order.receiptConfirmedAt && !order.receiptDisputedAt;
  const label = [heading, venue, `${(order.totalPrice / 100).toFixed(0)} ₽`, t(`orders.status.${order.status}`), needsReceipt ? t("receipt.rowHint") : null, date].filter(Boolean).join(", ");

  return (
    <Pressable
      onPress={() => onPress(order.id)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderColor: active ? `${tone}66` : theme.colors.border,
          borderRadius: theme.radii.lg,
          marginBottom: theme.spacing.sm,
          opacity: pressed ? 0.88 : 1,
          cursor: "pointer",
        },
        active && { boxShadow: `0 6px 18px ${tone}${dark ? "22" : "1a"}` },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: `${tone}${dark ? "24" : "1a"}` }]}>
        <Icon size={20} color={tone} strokeWidth={2.1} />
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          {title || !loading ? (
            <Text style={[theme.typography.bodyBold, styles.title, { color: theme.colors.text }]} numberOfLines={1}>
              {heading}
            </Text>
          ) : (
            <View style={[styles.skeleton, { backgroundColor: theme.colors.border, width: "58%" }]} />
          )}
          <Text style={[theme.fonts.heavy, styles.amount, { color: theme.colors.text }]}>
            {(order.totalPrice / 100).toFixed(0)} ₽
            {order.quantity > 1 ? <Text style={[styles.qty, { color: theme.colors.textMuted }]}>{` x${order.quantity}`}</Text> : null}
          </Text>
        </View>
        {venue ? (
          <Text style={[styles.venue, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {venue}
          </Text>
        ) : loading ? (
          <View style={[styles.skeleton, { backgroundColor: theme.colors.border, width: "36%", marginTop: 6 }]} />
        ) : null}
        <View style={styles.meta}>
          <StatusBadge status={order.status} label={t(`orders.status.${order.status}`)} />
          <Text style={[styles.date, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {date}
          </Text>
        </View>
        {needsReceipt ? <Text style={[styles.receipt, { color: theme.colors.ember }]}>{t("receipt.rowHint")}</Text> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  body: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 15 },
  amount: { fontSize: 15, letterSpacing: -0.3 },
  qty: { fontSize: 12, fontWeight: "600" },
  venue: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  date: { flexShrink: 1, fontSize: 12.5, lineHeight: 17 },
  receipt: { fontSize: 12.5, fontWeight: "700", lineHeight: 17, marginTop: 6 },
  skeleton: { height: 14, borderRadius: 7, opacity: 0.7 },
});
