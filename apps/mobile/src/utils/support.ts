/** Единственный канал поддержки, который есть в продукте сейчас (тот же адрес — в подвале сайта и в оферте). */
export const SUPPORT_EMAIL = "hello@apetite.ru";

/**
 * Короткий «человеческий» номер заказа для разговора со службой поддержки: последние 6 знаков идентификатора.
 * Полный id уходит в письмо отдельной строкой — по нему заказ находят точно.
 */
export function shortOrderNumber(orderId: string): string {
  return orderId.slice(-6).toUpperCase();
}

/**
 * Ссылка mailto: с темой и текстом письма. Кодируем через encodeURIComponent (пробел — %20): в mailto «+» не означает
 * пробел, и почтовые клиенты показали бы его буквально.
 */
export function buildMailto(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type SupportReason = "pickup" | "venueClosed" | "amount" | "cancel" | "other" | "general" | "payment" | "app";

/** Темы обращения: с заказом — про заказ, из профиля — общие. Выбранная тема попадает в письмо, поддержке не нужно переспрашивать. */
export const ORDER_REASONS: SupportReason[] = ["pickup", "venueClosed", "amount", "cancel", "other"];
export const GENERAL_REASONS: SupportReason[] = ["general", "payment", "app", "other"];

export interface SupportOrderInfo {
  id: string;
  title?: string;
  venue?: string;
  /** Сумма в копейках. */
  totalPrice: number;
  createdAt: string;
}
