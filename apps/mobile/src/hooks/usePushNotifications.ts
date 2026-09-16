import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import type { NavigationContainerRef } from "@react-navigation/native";
import { notificationsApi } from "../api/notifications";
import type { RootStackParamList } from "../navigation/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

interface PushNotificationData {
  orderId?: string;
}

/**
 * Реальный Expo push-токен требует EAS projectId (в этой бете не настроен — на
 * бэкенде тоже EXPO_PUSH_MODE=mock, см. ШАГ 6) и физическое устройство; на web/без
 * projectId getExpoPushTokenAsync ожидаемо падает — тогда просто не регистрируем
 * токен, остальной флоу (permission, тап по уведомлению → навигация) от него не зависит.
 */
export function usePushNotifications(
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function register() {
      const existing = await Notifications.getPermissionsAsync();
      let finalStatus = existing.status;
      if (finalStatus !== "granted") {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }
      if (finalStatus !== "granted" || cancelled) return;

      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        if (!cancelled) await notificationsApi.registerPushToken(token);
      } catch {
        // Нет EAS projectId / не физическое устройство / web — ожидаемо в этой бете.
      }
    }

    void register();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as PushNotificationData;
      if (data.orderId) {
        navigationRef.current?.navigate("OrderDetail", { orderId: data.orderId });
      } else {
        navigationRef.current?.navigate("Main", { screen: "Home" });
      }
    });
    return () => subscription.remove();
  }, [navigationRef, enabled]);
}
