import type { DiscountMode, OfferCategory, OfferSchedule } from "@apetite/shared";
import { apiClient } from "./client";

export interface OfferScheduleRequest {
  title: string;
  description?: string;
  category: OfferCategory;
  /** Рубли, не копейки. */
  originalPriceRub: number;
  baseDiscountPercent: number;
  discountMode: DiscountMode;
  weightKg: number;
  quantityTotal: number;
  imageUrl?: string | null;
  ingredients?: string;
  allergens?: string[];
  bestBeforeHoursAfterEnd?: number;
  daysOfWeek: number[];
  pickupStartTime: string;
  pickupEndTime: string;
  publishLeadMinutes: number;
  timezone: string;
  startsOn?: string | null;
  endsOn?: string | null;
  isActive?: boolean;
}

export interface CreateOfferScheduleRequest extends OfferScheduleRequest {
  businessId: string;
  /** Оффер, только что созданный вручную по этой же позиции: он считается первой выкладкой, дубля в тот день не будет. */
  linkOfferId?: string;
}

export interface SkipResult {
  schedule: OfferSchedule;
  archivedOfferId: string | null;
  keptBecauseOrders: boolean;
}

export const offerSchedulesApi = {
  list: (businessId: string) => apiClient.get<OfferSchedule[]>(`/offer-schedules?businessId=${encodeURIComponent(businessId)}`),
  create: (input: CreateOfferScheduleRequest) => apiClient.post<OfferSchedule>("/offer-schedules", input),
  update: (id: string, input: Partial<OfferScheduleRequest>) => apiClient.patch<OfferSchedule>(`/offer-schedules/${id}`, input),
  skip: (id: string, date: string) => apiClient.post<SkipResult>(`/offer-schedules/${id}/skip`, { date }),
  unskip: (id: string, date: string) => apiClient.delete<OfferSchedule>(`/offer-schedules/${id}/skip/${date}`),
  remove: (id: string) => apiClient.delete<{ success: boolean }>(`/offer-schedules/${id}`),
};
