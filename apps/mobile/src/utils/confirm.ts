import { Alert, Platform } from "react-native";

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (confirmed: boolean) => void;
}

let handler: ((request: ConfirmRequest) => void) | null = null;

/** ConfirmHost регистрирует себя здесь при монтировании; пока его нет — работает системный диалог. */
export function registerConfirmHandler(next: (request: ConfirmRequest) => void): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

/**
 * Подтверждение опасного действия. Основной путь — фирменная шторка (ConfirmHost); если хост
 * ещё не смонтирован: react-native-web не реализует Alert.alert (заглушка, колбэки не
 * срабатывают), поэтому на web откатываемся на window.confirm, на native — на Alert.alert.
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  cancelLabel: string
): Promise<boolean> {
  if (handler) {
    const show = handler;
    return new Promise((resolve) => show({ title, message, confirmLabel, cancelLabel, resolve }));
  }
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
