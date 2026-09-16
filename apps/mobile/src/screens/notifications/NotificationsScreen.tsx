import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { NotificationType, type Notification } from "@apetite/shared";
import { notificationsApi } from "../../api/notifications";
import { useTheme } from "../../theme/ThemeProvider";
import { Screen } from "../../components/Screen";
import { SegmentedControl } from "../../components/SegmentedControl";
import { LoadingView, EmptyView, ErrorView } from "../../components/StateViews";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"Notifications">;
type Filter = "all" | "unread";

const TYPE_ICON: Record<NotificationType, string> = {
  [NotificationType.NEARBY_OFFERS]: "📍",
  [NotificationType.PICKUP_REMINDER]: "⏰",
  [NotificationType.ORDER_CONFIRMED]: "✅",
  [NotificationType.ORDER_COMPLETED]: "🎉",
  [NotificationType.ORDER_EXPIRED]: "⌛",
  [NotificationType.ORDER_CANCELLED]: "❌",
};

export function NotificationsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (nextFilter: Filter) => {
    setError(null);
    try {
      const result = await notificationsApi.list({ unreadOnly: nextFilter === "unread", pageSize: 50 });
      setItems(result.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("common.error"));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load(filter);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  };

  const handlePress = async (item: Notification) => {
    if (!item.read) {
      setItems((prev) => (prev ? prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)) : prev));
      void notificationsApi.markRead(item.id).catch(() => {});
    }
    const orderId = item.data?.orderId;
    if (orderId) {
      navigation.navigate("OrderDetail", { orderId });
    } else {
      navigation.navigate("Main", { screen: "Home" });
    }
  };

  return (
    <Screen>
      <View style={{ marginBottom: theme.spacing.sm }}>
        <SegmentedControl
          value={filter}
          onChange={(value) => setFilter(value)}
          options={[
            { value: "all", label: t("notifications.filterAll") },
            { value: "unread", label: t("notifications.filterUnread") },
          ]}
        />
      </View>

      {items === null && !error ? (
        <LoadingView label={t("common.loading")} />
      ) : error ? (
        <ErrorView label={error} />
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <EmptyView label={filter === "unread" ? t("notifications.emptyUnread") : t("notifications.empty")} />
          }
          contentContainerStyle={items && items.length === 0 ? styles.grow : undefined}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void handlePress(item)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: item.read ? theme.colors.surface : theme.colors.surfaceElevated,
                  borderRadius: theme.radii.md,
                  borderWidth: item.read ? 0 : 1,
                  borderColor: theme.colors.primarySoft,
                  marginBottom: theme.spacing.sm,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.row}>
                <Text style={styles.icon}>{TYPE_ICON[item.type]}</Text>
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        item.read ? theme.typography.body : theme.typography.bodyBold,
                        { color: theme.colors.text, flex: 1 },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {item.read ? null : (
                      <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
                    )}
                  </View>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                    {item.body}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
                    {new Date(item.createdAt).toLocaleString("ru-RU")}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  icon: { fontSize: 20, marginRight: 10, marginTop: 1 },
  body: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  grow: { flexGrow: 1 },
});
