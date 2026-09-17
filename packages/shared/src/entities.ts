import {
  BusinessStatus,
  NotificationType,
  OfferCategory,
  OfferStatus,
  OrderStatus,
  PaymentStatus,
  Role,
} from "./enums";

/**
 * Контракты, которые "путешествуют по проводу" между backend, admin и mobile.
 * Даты — ISO 8601 строки (как приходят из JSON), деньги — целые копейки/минорные
 * единицы валюты, чтобы избежать ошибок округления с float.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  email: string;
  phone?: string | null;
  name: string;
  role: Role;
  /** Expo push-токен устройства (ШАГ 6/9) — одно устройство на аккаунт. */
  expoPushToken?: string | null;
  /** Последняя известная геопозиция — основа гео-триггера NEARBY_OFFERS (ШАГ 6). */
  lastLat?: number | null;
  lastLng?: number | null;
  notifyRadiusKm: number;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  ownerUserId: string;
  name: string;
  description?: string | null;
  category: OfferCategory;
  address: string;
  lat: number;
  lng: number;
  status: BusinessStatus;
  /** Комиссия платформы для заведения, % (по умолчанию — платформенная константа). */
  commissionPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  businessId: string;
  title: string;
  description?: string | null;
  category: OfferCategory;
  /** Оригинальная цена, минорные единицы валюты (копейки). */
  originalPrice: number;
  /** Цена с учётом текущей скидки — пересчитывается шедулером каждые 15 минут. */
  discountedPrice: number;
  /** Текущий % скидки: baseDiscountPercent → докручивается до 70 максимум по времени. */
  discountPercent: number;
  /** Стартовая скидка, которую задал владелец бизнеса (минимум MIN_BASE_PERCENT = 25%). */
  baseDiscountPercent: number;
  quantityTotal: number;
  quantityLeft: number;
  /** Вес одной единицы товара в кг — основа для эко-баллов и "спасённых кг". */
  weightKg: number;
  pickupStart: string;
  pickupEnd: string;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  userId: string;
  offerId: string;
  businessId: string;
  quantity: number;
  /** Итоговая сумма к оплате, минорные единицы валюты (копейки). */
  totalPrice: number;
  /** Комиссия платформы с этого заказа, минорные единицы валюты (копейки). */
  platformFee: number;
  status: OrderStatus;
  /** Код самовывоза (PIN), показывается пользователю и вводится/сканируется заведением. */
  pickupCode: string;
  createdAt: string;
  completedAt?: string | null;
  /** Когда отправлено напоминание "забери за 30 минут" (ШАГ 6). */
  pickupReminderSentAt?: string | null;
}

/** Ответ GET /offers/nearby — Offer с расстоянием и плоскими полями заведения (raw SQL, ШАГ 5). */
export interface NearbyOffer extends Offer {
  businessName: string;
  businessAddress: string;
  businessLat: number;
  businessLng: number;
  distanceKm: number;
}

export interface EcoTransaction {
  id: string;
  userId: string;
  orderId: string;
  /** Начисленные эко-баллы за заказ. */
  points: number;
  /** Спасённый вес, кг (из Offer.weightKg * quantity). */
  weightSavedKg: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string> | null;
  read: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  provider: string;
  externalId: string;
  /** Минорные единицы валюты (копейки). */
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
}
