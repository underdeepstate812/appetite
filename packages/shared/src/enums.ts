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
}

/** Статус mock-платежа (ШАГ 5) — форма совместима со Stripe/СБП для будущей замены. */
export enum PaymentStatus {
  PENDING = "PENDING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
}
