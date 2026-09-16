import type { CompletePickupRequest, CreateOrderRequest, Order } from "@apetite/shared";
import { apiClient } from "./client";

export interface OrderWithQr extends Order {
  qrCodeDataUrl: string;
}

export const ordersApi = {
  create: (input: CreateOrderRequest) => apiClient.post<OrderWithQr>("/orders", input),
  list: () => apiClient.get<Order[]>("/orders"),
  get: (id: string) => apiClient.get<Order>(`/orders/${id}`),
  getQrCode: (id: string) => apiClient.get<{ qrCodeDataUrl: string }>(`/orders/${id}/qrcode`),
  cancel: (id: string) => apiClient.patch<Order>(`/orders/${id}/cancel`),
  complete: (id: string, input: CompletePickupRequest) => apiClient.patch<Order>(`/orders/${id}/complete`, input),
};
