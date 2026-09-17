import { BusinessStatus, OfferCategory } from "./enums";
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
  /** Если указан, должен быть предварительно подтверждён через /auth/otp/verify. */
  phone?: string;
}

export interface RequestOtpRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  code: string;
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

/**
 * Строка таблицы заведений в панели платформы (ШАГ 11) — GET /platform/businesses.
 * Совмещает данные для модерации (статус, комиссия) со сводкой по выручке, чтобы
 * не гонять два запроса на один и тот же список.
 */
export interface PlatformBusinessSummary {
  id: string;
  name: string;
  category: OfferCategory;
  status: BusinessStatus;
  commissionPercent: number;
  address: string;
  ordersCompleted: number;
  /** Минорные единицы валюты (копейки), только по COMPLETED-заказам. */
  revenue: number;
  platformFee: number;
  createdAt: string;
}

/**
 * Платформенная сводка (ШАГ 11) — GET /platform/stats. В отличие от BusinessStats
 * (одно заведение), здесь агрегация по ВСЕЙ платформе — это и есть GMV.
 */
export interface PlatformStats {
  businessesTotal: number;
  businessesActive: number;
  businessesSuspended: number;
  businessesPending: number;
  activeOffersCount: number;
  totalOrders: number;
  confirmedOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  expiredOrders: number;
  /** GMV — суммарная стоимость всех выданных (COMPLETED) заказов по всей платформе, копейки. */
  gmv: number;
  /** Фактический доход платформы — сумма platformFee по выданным заказам, копейки. */
  platformRevenue: number;
  weightSavedKg: number;
}
