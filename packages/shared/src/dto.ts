import { BusinessStatus, OfferCategory, ReceiptDisputeReason } from "./enums";
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
  /** Email или телефон в формате +7XXXXXXXXXX — backend сам определяет, что это. */
  identifier: string;
  password: string;
}

export interface BusinessApplicationRequest {
  name: string;
  category: OfferCategory;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  ofertaAccepted: boolean;
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

/** Телефон сюда не входит намеренно — он обязателен для входа/заказов и не редактируется. */
export interface UpdateProfileRequest {
  name?: string;
  email?: string;
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

/**
 * Ответ покупателя после того, как заведение отметило выдачу (POST /orders/:id/receipt):
 * received=true — «получил»; received=false — спор, причина обязательна, пояснение — по желанию.
 */
export interface ConfirmReceiptRequest {
  received: boolean;
  reason?: ReceiptDisputeReason;
  note?: string;
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
  /** Сколько заказов покупатель оспорил после выдачи (ждут разбора платформой). */
  disputedOrders: number;
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
  /** Реально удержанная комиссия, копейки — 0, пока не истёк пробный период (trialEndsAt). */
  platformFee: number;
  /** null — пробного периода не было (заведение онбордили до появления этой настройки). */
  trialEndsAt: string | null;
  createdAt: string;
}

/** Платформенные настройки (ШАГ 0/11) — GET/PUT /platform/settings, только ADMIN. */
export interface PlatformSettings {
  trialPeriodDays: number;
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
  /** Сколько заказов покупатель оспорил после выдачи (ждут разбора платформой). */
  disputedOrders: number;
  /** GMV — суммарная стоимость всех выданных (COMPLETED) заказов по всей платформе, копейки. */
  gmv: number;
  /** Фактический доход платформы — сумма platformFee по выданным заказам, копейки. */
  platformRevenue: number;
  weightSavedKg: number;
}
