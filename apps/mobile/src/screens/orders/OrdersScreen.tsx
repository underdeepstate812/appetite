import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text } from "react-native";
import Receipt from "lucide-react-native/icons/receipt-text";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import type { Order } from "@apetite/shared";
import { ordersApi } from "../../api/orders";
import { isNetworkError, isServerUnavailable } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { loadOrders, saveOrders } from "../../utils/ordersCache";
import { useTheme } from "../../theme/ThemeProvider";
import { seedOrderLabels, snapshotOrderLabels, useOrderLabels } from "../../hooks/useOrderLabels";
import { Screen } from "../../components/Screen";
import { OrderRow } from "../../components/OrderRow";
import { OfflineNotice } from "../../components/OfflineNotice";
import { ErrorView } from "../../components/StateViews";
import { EmptyState, OfflineState } from "../../components/kit/EmptyState";
import { OrdersListSkeleton } from "../../components/kit/Skeleton";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Orders">;

export function OrdersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineError, setOfflineError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  /** Не null — список показан из сохранённой копии (время её создания), потому что сервер недоступен. */
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);
  const labels = useOrderLabels(orders);
  const openOrder = useCallback((orderId: string) => navigation.navigate("OrderDetail", { orderId }), [navigation]);

  const load = useCallback(async () => {
    setError(null);
    setOfflineError(false);
    try {
      const data = await ordersApi.list();
      setOrders(data);
      setOfflineSavedAt(null);
    } catch (loadError) {
      // Путь к билету идёт через этот список: без связи показываем сохранённый, а не пустую ошибку.
      const saved = isServerUnavailable(loadError) ? await loadOrders(userId) : null;
      if (saved) {
        seedOrderLabels(saved.titles, saved.venues);
        setOrders(saved.orders);
        setOfflineSavedAt(saved.savedAt);
      } else {
        setError(loadError instanceof Error ? loadError.message : t("common.error"));
        setOfflineError(isNetworkError(loadError));
      }
    }
  }, [t, userId]);

  // Свежий список (вместе с подписями) — в сохранённую копию. Из самой копии заново не пишем: это стёрло бы время сохранения.
  useEffect(() => {
    if (!orders || offlineSavedAt || labels.pending || !userId) return;
    void saveOrders({ userId, savedAt: new Date().toISOString(), orders, ...snapshotOrderLabels(orders) });
  }, [orders, offlineSavedAt, labels.pending, labels.version, userId]);

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

  // Загрузка — заглушки в форме строк заказа (а не спиннер): после загрузки ничего не «прыгает».
  if (orders === null && !error) {
    return (
      <Screen>
        <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.md }]}>{t("orders.title")}</Text>
        <OrdersListSkeleton label={t("common.loading")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={[theme.typography.h1, { color: theme.colors.text, marginBottom: theme.spacing.md }]}>
        {t("orders.title")}
      </Text>
      {offlineSavedAt ? <OfflineNotice kind="list" savedAt={offlineSavedAt} onRetry={() => void load()} /> : null}
      {error ? (
        offlineError ? <OfflineState onRetry={() => void load()} /> : <ErrorView label={error} onRetry={() => void load()} />
      ) : (
        <FlatList
          data={orders ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <EmptyState
              icon={(color) => <Receipt size={30} color={color} strokeWidth={2.1} />}
              title={t("states.ordersEmptyTitle")}
              description={t("states.ordersEmptyHint")}
              action={{ label: t("states.ordersEmptyCta"), onPress: () => navigation.navigate("Home") }}
            />
          }
          contentContainerStyle={orders && orders.length === 0 ? styles.grow : undefined}
          renderItem={({ item }) => (
            <OrderRow order={item} title={labels.titleOf(item)} venue={labels.venueOf(item)} loading={labels.pending} onPress={openOrder} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ grow: { flexGrow: 1 } });
