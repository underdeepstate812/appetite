import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import type { Order, OrderStatus } from "@apetite/shared";
import { ordersApi } from "../../api/orders";
import { useTheme } from "../../theme/ThemeProvider";
import Receipt from "lucide-react-native/icons/receipt-text";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CircleX from "lucide-react-native/icons/circle-x";
import Hourglass from "lucide-react-native/icons/hourglass";
import { Screen } from "../../components/Screen";
import { LoadingView, EmptyView, ErrorView } from "../../components/StateViews";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Orders">;

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

export function OrdersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await ordersApi.list();
      setOrders(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("common.error"));
    }
  }, [t]);

  // Перезагружаем при каждом возврате на экран — важно после отмены/выдачи заказа.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (orders === null && !error) {
    return (
      <Screen>
        <LoadingView label={t("common.loading")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.md }]}>
        {t("orders.title")}
      </Text>
      {error ? (
        <ErrorView label={error} onRetry={() => void load()} />
      ) : (
        <FlatList
          data={orders ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={<EmptyView label={t("orders.empty")} />}
          contentContainerStyle={orders && orders.length === 0 ? styles.grow : undefined}
          renderItem={({ item }) => {
            const tone = theme.colors[STATUS_COLOR[item.status]];
            const Icon = STATUS_ICON[item.status];
            const active = item.status === "CONFIRMED";
            return (
              <Pressable
                onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })}
                accessibilityRole="button"
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
                  active && { boxShadow: `0 6px 18px ${tone}${theme.mode === "dark" ? "22" : "1a"}` },
                ]}
              >
                <View style={[styles.badge, { backgroundColor: `${tone}${theme.mode === "dark" ? "24" : "1a"}` }]}>
                  <Icon size={20} color={tone} strokeWidth={2.1} />
                </View>
                <View style={styles.body}>
                  <View style={styles.row}>
                    <Text style={[theme.fonts.heavy, styles.amount, { color: theme.colors.text }]}>
                      {(item.totalPrice / 100).toFixed(0)} ₽ <Text style={[styles.qty, { color: theme.colors.textMuted }]}>x{item.quantity}</Text>
                    </Text>
                    <Text style={[styles.status, { color: tone }]}>{t(`orders.status.${item.status}`)}</Text>
                  </View>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
                    {new Date(item.createdAt).toLocaleString("ru-RU")}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  body: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  amount: { fontSize: 16, letterSpacing: -0.3 },
  qty: { fontSize: 12, fontWeight: "600" },
  status: { fontSize: 12.5, fontWeight: "700" },
  grow: { flexGrow: 1 },
});
