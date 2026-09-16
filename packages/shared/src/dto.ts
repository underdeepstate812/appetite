import { OfferCategory } from "./enums";
import { GeoPoint } from "./entities";

/**
 * Контракты запросов/ответов ключевых эндпоинтов. Полный набор DTO наращивается
 * по мере реализации backend (ШАГ 4+) — здесь только каркас для первых сценариев.
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface NearbyOffersQuery extends GeoPoint {
  /** Радиус поиска в километрах. */
  radiusKm: number;
  category?: OfferCategory;
  minDiscount?: number;
}

export interface CreateOrderRequest {
  offerId: string;
  quantity: number;
}

/** orderId передаётся в URL (PATCH /orders/:id/complete), не в теле. */
export interface CompletePickupRequest {
  pickupCode: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
