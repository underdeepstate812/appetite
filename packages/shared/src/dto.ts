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

/**
 * Сводка по заведению для панели бизнеса (ШАГ 10) — GET /businesses/:id/stats.
 * Кросс-заведенческий GMV/комиссия платформы — отдельная платформенная сводка ШАГ 11,
 * не здесь: это только цифры одного конкретного заведения.
 */
export interface BusinessStats {
  activeOffersCount: number;
  totalOrders: number;
  confirmedOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  expiredOrders: number;
  /** Минорные единицы валюты (копейки), только по COMPLETED-заказам. */
  revenue: number;
  /** Комиссия платформы, копейки, только по COMPLETED-заказам. */
  platformFee: number;
  weightSavedKg: number;
}
