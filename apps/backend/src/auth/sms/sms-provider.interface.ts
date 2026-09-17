export const SMS_PROVIDER = Symbol("SMS_PROVIDER");

/**
 * Контракт, за которым прячется SMS-провайдер (Twilio/SMS.ru/SMSC и т.п.) — тот же
 * паттерн, что PaymentProvider (ШАГ 5) и PushProvider (ШАГ 6): сейчас единственная
 * реализация — mock, переключение на реальный провайдер — новый класс + DI-биндинг
 * в AuthModule, без изменений в AuthService.
 */
export interface SmsProvider {
  readonly name: string;
  send(phone: string, message: string): Promise<void>;
}
