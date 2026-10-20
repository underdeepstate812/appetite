import {
  BusinessApplicationStatus,
  DiscountMode,
  BusinessStatus,
  NotificationType,
  OfferCategory,
  OfferStatus,
  OrderStatus,
  PaymentStatus,
  ReceiptDisputeReason,
  Role,
} from "./enums";
import type { WorkingHours } from "./working-hours";

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
  avatarUrl?: string | null;
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
  /** Логотип заведения — опционально, без него показывается плейсхолдер с инициалом. */
  logoUrl?: string | null;
  /** Пока не истекло — комиссия фактически 0% (бесплатное подключение на старте), см. orders.service.ts. */
  trialEndsAt?: string | null;
  /** Часовой пояс заведения (IANA): по нему читаются часы работы. */
  timezone: string;
  /** Часы работы; null — не заданы (тогда окно оффера ограничено только общими правилами). Самовывоз обязан уложиться в них. */
  workingHours?: WorkingHours | null;
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
  /** Растёт ли скидка со временем (DYNAMIC) или фиксирована (FIXED); у старых офферов — DYNAMIC. */
  discountMode?: DiscountMode;
  /** Оффер выложен автоматически по этому шаблону; null — создан вручную. */
  scheduleId?: string | null;
  /** Локальная дата выкладки по шаблону («2026-10-19»): один оффер на шаблон и дату. */
  occurrenceDate?: string | null;
  /** Фото товара — опционально, без него показывается плейсхолдер по категории. */
  imageUrl?: string | null;
  quantityTotal: number;
  quantityLeft: number;
  /** Вес одной единицы товара в кг — основа для эко-баллов и "спасённых кг". */
  weightKg: number;
  pickupStart: string;
  pickupEnd: string;
  status: OfferStatus;
  /** «Горячее предложение дня»: показывается самым горячим и первым независимо от оставшегося времени. */
  featured: boolean;
  /** Состав — обязателен для еды, выпечки и продуктов (см. requiresFoodInfo); у старых предложений может отсутствовать. */
  ingredients?: string | null;
  /** Коды аллергенов (OFFER_ALLERGENS). Пустой список + allergensDeclared = «аллергенов нет». */
  allergens?: string[];
  /** Заведение явно указало аллергены (в том числе «нет»); false — информации нет, покупателю нужно уточнить у заведения. */
  allergensDeclared?: boolean;
  /** Срок годности (ISO). */
  bestBefore?: string | null;
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
  /** Когда заведение подтвердило заказ — после этого момента отменить заказ уже нельзя. */
  acceptedAt?: string | null;
  completedAt?: string | null;
  /** Когда отправлено напоминание "забери за 30 минут" (ШАГ 6). */
  pickupReminderSentAt?: string | null;
  /** Покупатель подтвердил, что получил заказ (после того, как заведение отметило выдачу). */
  receiptConfirmedAt?: string | null;
  /** Покупатель сообщил, что заказ не получен или получен не так — спор разбирает платформа. */
  receiptDisputedAt?: string | null;
  receiptDisputeReason?: ReceiptDisputeReason | null;
  receiptDisputeNote?: string | null;
}

/** Ответ GET /offers/nearby — Offer с расстоянием и плоскими полями заведения (raw SQL, ШАГ 5). */
export interface NearbyOffer extends Offer {
  businessName: string;
  businessAddress: string;
  businessLat: number;
  businessLng: number;
  businessLogoUrl?: string | null;
  distanceKm: number;
}

/** Заявка на подключение с публичной формы "Для бизнеса" — см. BusinessApplicationStatus. */
export interface BusinessApplication {
  id: string;
  name: string;
  category: OfferCategory;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  ofertaAccepted: boolean;
  status: BusinessApplicationStatus;
  createdAt: string;
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

/**
 * Шаблон автовыкладки: заведение один раз описывает позицию и расписание, а платформа сама выкладывает оффер в нужные
 * дни — не надо каждый день вносить одно и то же. Времена — «стенные часы» часового пояса timezone (IANA).
 */
export interface OfferSchedule {
  id: string;
  businessId: string;
  title: string;
  description?: string | null;
  category: OfferCategory;
  /** Минорные единицы валюты (копейки). */
  originalPrice: number;
  baseDiscountPercent: number;
  discountMode: DiscountMode;
  imageUrl?: string | null;
  quantityTotal: number;
  weightKg: number;
  ingredients?: string | null;
  allergens?: string[];
  allergensDeclared?: boolean;
  /** Срок годности каждого оффера = конец самовывоза + столько часов (для еды обязателен). */
  bestBeforeHoursAfterEnd?: number | null;
  /** ISO-дни недели, 1 = понедельник … 7 = воскресенье. */
  daysOfWeek: number[];
  /** «HH:mm»; конец не позже начала — окно заканчивается на следующие сутки. */
  pickupStartTime: string;
  pickupEndTime: string;
  /** За сколько минут до начала самовывоза оффер появляется на витрине (в «Вечерних»). */
  publishLeadMinutes: number;
  timezone: string;
  /** Границы действия «YYYY-MM-DD» (включительно); null — без границы. */
  startsOn?: string | null;
  endsOn?: string | null;
  /** Даты «YYYY-MM-DD», в которые выкладку пропускаем (праздник, выходной). */
  skipDates: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
