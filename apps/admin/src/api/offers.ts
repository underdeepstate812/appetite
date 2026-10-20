import type { DiscountMode, Offer, OfferCategory, OfferStatus, Paginated } from "@apetite/shared";
import { apiClient, toQueryString } from "./client";

export interface ListOffersQuery {
  businessId?: string;
  category?: OfferCategory;
  status?: OfferStatus;
  page?: number;
  pageSize?: number;
}

export interface CreateOfferRequest {
  businessId: string;
  title: string;
  description?: string;
  category: OfferCategory;
  /** Рубли, не копейки — backend сам переводит в минорные единицы. */
  originalPriceRub: number;
  weightKg: number;
  quantityTotal: number;
  pickupStart: string;
  pickupEnd: string;
  /** Стартовая скидка, минимум 25% — шедулер только докручивает её вверх по времени. */
  baseDiscountPercent: number;
  /** DYNAMIC (по умолчанию) — скидка растёт к концу самовывоза; FIXED — всегда равна baseDiscountPercent. */
  discountMode?: DiscountMode;
  /** Загруженное фото (/uploads/offers/…) или фото из библиотеки (/presets/…); без него покупатель видит значок категории. */
  imageUrl?: string;
  /** Состав, аллергены (пустой список = «нет») и срок годности — обязательны для еды, выпечки и продуктов. */
  ingredients?: string;
  allergens?: string[];
  bestBefore?: string;
}

export interface UpdateOfferRequest {
  title?: string;
  description?: string;
  category?: OfferCategory;
  originalPriceRub?: number;
  weightKg?: number;
  /** Всего выложено (проданные входят); меньше проданного backend не принимает. */
  quantityTotal?: number;
  pickupStart?: string;
  pickupEnd?: string;
  status?: OfferStatus;
  baseDiscountPercent?: number;
  discountMode?: DiscountMode;
  /** null — убрать фото; undefined — не менять. */
  imageUrl?: string | null;
  ingredients?: string;
  allergens?: string[];
  bestBefore?: string;
}

/** Фото из библиотеки по умолчанию (GET /offers/photo-presets). */
export interface PhotoPreset {
  id: string;
  label: string;
  url: string;
  category: OfferCategory;
}

export const offersApi = {
  list: (query: ListOffersQuery = {}) => apiClient.get<Paginated<Offer>>(`/offers${toQueryString(query)}`),
  create: (input: CreateOfferRequest) => apiClient.post<Offer>("/offers", input),
  update: (id: string, input: UpdateOfferRequest) => apiClient.patch<Offer>(`/offers/${id}`, input),
  /** Загрузка собственного фото: возвращает imageUrl, который затем передаётся в create/update. */
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.append("photo", file);
    return apiClient.post<{ imageUrl: string }>("/offers/photo", form);
  },
  photoPresets: () => apiClient.get<PhotoPreset[]>("/offers/photo-presets", { auth: false }),
  /** skippedDate — дата авто-оффера, которую backend внёс в пропуски шаблона, чтобы оффер не выложился заново. */
  remove: (id: string) => apiClient.delete<{ success: boolean; skippedDate: string | null }>(`/offers/${id}`),
};
