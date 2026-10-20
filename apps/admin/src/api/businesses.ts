import type { Business, BusinessSales, BusinessStats, BusinessStatus, OfferCategory, SalesPeriod, WorkingHours } from "@apetite/shared";
import { apiClient } from "./client";

export interface UpdateBusinessRequest {
  name?: string;
  description?: string;
  address?: string;
  /** ADMIN-only — backend молча игнорирует поле для не-админа. */
  status?: BusinessStatus;
  commissionPercent?: number;
}

export interface CreateBusinessRequest {
  ownerEmail: string;
  ownerPassword: string;
  ownerName: string;
  name: string;
  description?: string;
  category: OfferCategory;
  address: string;
  lat: number;
  lng: number;
}

export interface HoursConflict {
  id: string;
  title: string;
  reason: string;
}
/** Что из уже выложенного не влезает в новые часы работы (его не трогаем, только сообщаем). */
export interface WorkingHoursConflicts {
  offers: HoursConflict[];
  schedules: HoursConflict[];
}

export const businessesApi = {
  mine: () => apiClient.get<Business[]>("/businesses/mine"),
  update: (id: string, input: UpdateBusinessRequest) => apiClient.patch<Business>(`/businesses/${id}`, input),
  stats: (id: string) => apiClient.get<BusinessStats>(`/businesses/${id}/stats`),
  /** Продажи по дням за 7/14/30 дней + «когда покупают» (график на странице «Аналитика»). */
  sales: (id: string, days: SalesPeriod) => apiClient.get<BusinessSales>(`/businesses/${id}/sales?days=${days}`),
  /** Часы работы (null — снять ограничение). Ответ: заведение и список выложенного, что в новые часы не влезает. */
  setWorkingHours: (id: string, workingHours: WorkingHours | null) =>
    apiClient.put<{ business: Business; conflicts: WorkingHoursConflicts }>(`/businesses/${id}/working-hours`, { workingHours }),
  /** ADMIN-only — ручной онбординг (ШАГ 0/11): один запрос создаёт и владельца, и заведение. */
  create: (input: CreateBusinessRequest) => apiClient.post<Business>("/businesses", input),
};
