import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { notificationsApi } from "../api/notifications";

const POLL_INTERVAL_MS = 60000;

/** pageSize: 1 — нужен только total из пагинации, не сам список. */
export function useUnreadNotificationsCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const result = await notificationsApi.list({ unreadOnly: true, pageSize: 1 });
      setCount(result.total);
    } catch {
      // Бейдж — не критичный UI, тихо оставляем прошлое значение при сетевой ошибке.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return count;
}
