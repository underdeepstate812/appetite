import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import type { Order, OrderStatus } from "@apetite/shared";
import { ordersApi } from "../../api/orders";
import { useTheme } from "../../theme/ThemeProvider";
import { Screen } from "../../components/Screen";
import { LoadingView, EmptyView, ErrorView } from "../../components/StateViews";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Orders">;

const STATUS_COLOR: Record<OrderStatus, "primary" | "success" | "danger" | "textMuted"> = {
  CONFIRMED: "primary",
  COMPLETED: "success",
  CANCELLED: "danger",
  EXPIRED: "textMuted",
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
        <ErrorView label={error} />
      ) : (
        <FlatList
          data={orders ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={<EmptyView label={t("orders.empty")} />}
          contentContainerStyle={orders && orders.length === 0 ? styles.grow : undefined}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate("OrderDetail", { orderId: item.id })}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radii.md,
                  marginBottom: theme.spacing.sm,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.row}>
                <Text style={[theme.typography.bodyBold, { color: theme.colors.text }]}>
                  {(item.totalPrice / 100).toFixed(0)} ₽ · x{item.quantity}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors[STATUS_COLOR[item.status]] }]}>
                  {t(`orders.status.${item.status}`)}
                </Text>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
                {new Date(item.createdAt).toLocaleString("ru-RU")}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  grow: { flexGrow: 1 },
});
