import type { Notification, Paginated } from "@apetite/shared";
import { apiClient, toQueryString } from "./client";

export interface ListNotificationsQuery {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export const notificationsApi = {
  list: (query: ListNotificationsQuery = {}) =>
    apiClient.get<Paginated<Notification>>(`/notifications${toQueryString(query)}`),
  markRead: (id: string) => apiClient.patch<Notification>(`/notifications/${id}/read`),
  registerPushToken: (token: string) => apiClient.post<{ success: boolean }>("/notifications/push-token", { token }),
};
