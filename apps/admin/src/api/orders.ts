import type { Order } from "@apetite/shared";
import { apiClient } from "./client";

export const ordersApi = {
  list: () => apiClient.get<Order[]>("/orders"),
  accept: (id: string) => apiClient.patch<Order>(`/orders/${id}/accept`),
  complete: (id: string, pickupCode: string) => apiClient.patch<Order>(`/orders/${id}/complete`, { pickupCode }),
};
