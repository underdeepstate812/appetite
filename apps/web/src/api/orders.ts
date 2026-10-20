import type { ConfirmReceiptRequest, CreateOrderRequest, Order } from "@apetite/shared";
import { apiClient } from "./client";

export interface OrderWithQr extends Order {
  qrCodeDataUrl: string;
}

export const ordersApi = {
  create: (input: CreateOrderRequest) => apiClient.post<OrderWithQr>("/orders", input),
  list: () => apiClient.get<Order[]>("/orders"),
  get: (id: string) => apiClient.get<Order>(`/orders/${id}`),
  /** Ответ покупателя после выдачи: «получил» либо спор (причина обязательна). */
  confirmReceipt: (id: string, input: ConfirmReceiptRequest) => apiClient.post<Order>(`/orders/${id}/receipt`, input),
  getQrCode: (id: string) => apiClient.get<{ qrCodeDataUrl: string }>(`/orders/${id}/qrcode`),
};
