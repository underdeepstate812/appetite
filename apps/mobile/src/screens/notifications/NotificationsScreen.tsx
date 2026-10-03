import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { NotificationType, type Notification } from "@apetite/shared";
import { notificationsApi } from "../../api/notifications";
import { useTheme } from "../../theme/ThemeProvider";
import MapPin from "lucide-react-native/icons/map-pin";
import Clock from "lucide-react-native/icons/clock";
import CircleCheck from "lucide-react-native/icons/circle-check";
import PartyPopper from "lucide-react-native/icons/party-popper";
import Hourglass from "lucide-react-native/icons/hourglass";
import CircleX from "lucide-react-native/icons/circle-x";
import { Screen } from "../../components/Screen";
import { SegmentedControl } from "../../components/SegmentedControl";
import { LoadingView, EmptyView, ErrorView } from "../../components/StateViews";
import type { RootStackScreenProps } from "../../navigation/types";

type Props = RootStackScreenProps<"Notifications">;
type Filter = "all" | "unread";

type ToneKey = "primary" | "ember" | "success" | "warning" | "textMuted";

const TYPE_STYLE: Record<NotificationType, { Icon: typeof MapPin; tone: ToneKey }> = {
  [NotificationType.NEARBY_OFFERS]: { Icon: MapPin, tone: "primary" },
  [NotificationType.PICKUP_REMINDER]: { Icon: Clock, tone: "ember" },
  [NotificationType.ORDER_CONFIRMED]: { Icon: CircleCheck, tone: "primary" },
  [NotificationType.ORDER_COMPLETED]: { Icon: PartyPopper, tone: "success" },
  [NotificationType.ORDER_EXPIRED]: { Icon: Hourglass, tone: "warning" },
  [NotificationType.ORDER_CANCELLED]: { Icon: CircleX, tone: "textMuted" },
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
        <ErrorView label={error} onRetry={() => void load(filter)} />
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <EmptyView label={filter === "unread" ? t("notifications.emptyUnread") : t("notifications.empty")} />
          }
          contentContainerStyle={items && items.length === 0 ? styles.grow : undefined}
          renderItem={({ item }) => {
            const { Icon, tone } = TYPE_STYLE[item.type];
            const toneColor = theme.colors[tone];
            return (
            <Pressable
              onPress={() => void handlePress(item)}
              style={({ pressed }) => [
                styles.card,
                {
                  // Непрочитанное "приподнято" (плитка с рамкой и тенью), прочитанное "осело" — плоская строка с нижней линией.
                  backgroundColor: item.read ? "transparent" : theme.colors.surfaceElevated,
                  borderRadius: item.read ? 0 : theme.radii.lg,
                  borderWidth: item.read ? 0 : 1,
                  borderBottomWidth: item.read ? StyleSheet.hairlineWidth : 1,
                  borderColor: theme.colors.border,
                  boxShadow: item.read ? undefined : theme.mode === "dark" ? "0 8px 20px -10px rgba(0,0,0,0.7)" : "0 8px 20px -12px rgba(26,22,15,0.25)",
                  marginBottom: theme.spacing.sm,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.row}>
                <View style={[styles.iconWrap, item.read ? { borderWidth: 1, borderColor: theme.colors.border } : { backgroundColor: `${toneColor}${theme.mode === "dark" ? "24" : "1a"}` }]}>
                  <Icon size={18} color={item.read ? theme.colors.textMuted : toneColor} strokeWidth={2.1} />
                </View>
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
                      <View style={[styles.dot, { backgroundColor: theme.colors.primary, boxShadow: `0 0 8px ${theme.colors.primary}` }]} />
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
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginRight: 12 },
  body: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  dot: { width: 9, height: 9, borderRadius: 5, marginLeft: 8 },
  grow: { flexGrow: 1 },
});
