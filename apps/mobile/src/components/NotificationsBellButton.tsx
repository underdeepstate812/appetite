import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { useUnreadNotificationsCount } from "../hooks/useUnreadNotificationsCount";
import type { RootStackParamList } from "../navigation/types";

/**
 * Бейдж — насыщенный danger, не soft-тон: непрочитанное уведомление — это сигнал
 * "требует внимания", а не нейтральный статус, поэтому здесь единственное место
 * в приложении, где soft-заливка сознательно не используется.
 */
export function NotificationsBellButton() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const unreadCount = useUnreadNotificationsCount();

  return (
    <Pressable
      onPress={() => navigation.navigate("Notifications")}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
      hitSlop={8}
    >
      <Text style={styles.icon}>🔔</Text>
      {unreadCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.danger, borderColor: theme.colors.background }]}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 44x44 — минимальный touch-таргет, хотя визуальная иконка меньше.
  button: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 22 },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
});
