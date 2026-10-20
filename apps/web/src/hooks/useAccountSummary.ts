import { useCallback, useEffect, useState } from "react";
import { ordersApi } from "../api/orders";
import { EMPTY_SUMMARY, summarizeOrders, type AccountSummary } from "../utils/accountSummary";

/**
 * Сводка для личного кабинета в шапке («1 ждёт самовывоза»). Грузится один раз после входа и по требованию (refresh — при открытии
 * меню): без сети или при ошибке просто молчит, шапка не должна ломаться из-за бейджа.
 */
export function useAccountSummary(userId: string | null): { summary: AccountSummary; refresh: () => void } {
  const [summary, setSummary] = useState<AccountSummary>(EMPTY_SUMMARY);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) {
      setSummary(EMPTY_SUMMARY);
      return;
    }
    let cancelled = false;
    ordersApi
      .list()
      .then((orders) => {
        if (!cancelled) setSummary(summarizeOrders(orders));
      })
      .catch(() => {
        /* бейдж — не критично */
      });
    return () => {
      cancelled = true;
    };
  }, [userId, tick]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);
  return { summary, refresh };
}
