export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export const PUSH_PROVIDER = Symbol("PUSH_PROVIDER");

/**
 * Контракт поверх Expo Notifications. Сейчас единственная реализация — мок
 * (логирует вместо реальной отправки, EXPO_PUSH_MODE=mock); переключение на
 * настоящий expo-server-sdk — новый класс + DI-биндинг в NotificationsModule.
 */
export interface PushProvider {
  readonly name: string;
  send(token: string, message: PushMessage): Promise<void>;
}
