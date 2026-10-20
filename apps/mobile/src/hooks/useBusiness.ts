import { useCallback, useEffect, useState } from "react";
import type { Business } from "@apetite/shared";
import { businessesApi } from "../api/businesses";

/** Что нужно знать о заведении для «где забрать»: то же самое лежит и в офлайн-копии билета, поэтому не весь Business. */
export type VenueInfo = Pick<Business, "id" | "name" | "address" | "lat" | "lng">;

export type BusinessState = { status: "loading" } | { status: "ready"; business: VenueInfo } | { status: "failed" };

/**
 * Заведение по id для «где забрать». Название и адрес важны, но не критичны: сбой этого запроса не должен
 * ломать оплату или билет — экран получает `failed` и предлагает повторить, а не падает.
 */
export function useBusiness(businessId: string | null | undefined): { state: BusinessState; retry: () => void } {
  const [state, setState] = useState<BusinessState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    setState({ status: "loading" });
    businessesApi
      .get(businessId)
      .then((business) => !cancelled && setState({ status: "ready", business }))
      .catch(() => !cancelled && setState({ status: "failed" }));
    return () => {
      cancelled = true;
    };
  }, [businessId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
