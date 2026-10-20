/** Роль пользователя в системе. */
export enum Role {
  USER = "USER",
  BUSINESS = "BUSINESS",
  ADMIN = "ADMIN",
}

/** Категория предложения (оффера). */
export enum OfferCategory {
  FOOD = "FOOD",
  BAKERY = "BAKERY",
  FLOWERS = "FLOWERS",
  GROCERIES = "GROCERIES",
}

/**
 * Как меняется скидка оффера.
 * DYNAMIC — растёт к концу самовывоза (+10% за 2 часа, +20% за час, максимум 70%): стартовая скидка владельца — нижняя граница.
 * FIXED — всё время ровно та, что указал владелец; шедулер её не трогает.
 */
export enum DiscountMode {
  DYNAMIC = "DYNAMIC",
  FIXED = "FIXED",
}

/** Статус предложения. */
export enum OfferStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  SOLD_OUT = "SOLD_OUT",
  ARCHIVED = "ARCHIVED",
}

/**
 * Статус заказа.
 * CONFIRMED — оплачен (mock), ожидает самовывоза.
 * COMPLETED — забран пользователем, начислены эко-баллы.
 * CANCELLED — отменён пользователем до окончания pickup-окна.
 * EXPIRED — не выкуплен до pickupEnd, отменяется шедулером.
 */
export enum OrderStatus {
  CONFIRMED = "CONFIRMED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

/** Статус модерации заведения платформенным админом. */
export enum BusinessStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

/** Тип push-уведомления. */
export enum NotificationType {
  NEARBY_OFFERS = "NEARBY_OFFERS",
  PICKUP_REMINDER = "PICKUP_REMINDER",
  ORDER_CONFIRMED = "ORDER_CONFIRMED",
  ORDER_COMPLETED = "ORDER_COMPLETED",
  ORDER_EXPIRED = "ORDER_EXPIRED",
  ORDER_CANCELLED = "ORDER_CANCELLED",
  /** Покупатель оспорил получение заказа — админу платформы и заведению. */
  RECEIPT_DISPUTED = "RECEIPT_DISPUTED",
}

/** Причина, по которой покупатель сообщает, что заказ не получен или получен не так. */
export enum ReceiptDisputeReason {
  NOT_RECEIVED = "NOT_RECEIVED",
  WRONG_ITEM = "WRONG_ITEM",
  QUALITY = "QUALITY",
  OTHER = "OTHER",
}

/** Статус mock-платежа (ШАГ 5) — форма совместима со Stripe/СБП для будущей замены. */
export enum PaymentStatus {
  PENDING = "PENDING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
}

/** Статус заявки на подключение бизнеса (публичная форма, ручной обзор админом). */
export enum BusinessApplicationStatus {
  NEW = "NEW",
  REVIEWED = "REVIEWED",
}
