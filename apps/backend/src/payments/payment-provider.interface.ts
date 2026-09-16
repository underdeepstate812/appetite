import { PaymentStatus } from "@prisma/client";

export interface ChargeInput {
  /** Минорные единицы валюты (копейки). */
  amount: number;
  currency: string;
}

export interface ChargeResult {
  /** id платежа во внешней системе (у mock — сгенерированный, у Stripe/СБП — их id). */
  externalId: string;
  status: PaymentStatus;
}

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

/**
 * Контракт, за которым прячется провайдер оплаты. Сейчас единственная реализация —
 * MockPaymentProvider; переключение на Stripe/СБП — новый класс + DI-биндинг
 * в PaymentsModule, без изменений в PaymentsService/OrdersService.
 */
export interface PaymentProvider {
  readonly name: string;
  charge(input: ChargeInput): Promise<ChargeResult>;
}
