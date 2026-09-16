import { Alert, Platform } from "react-native";

/**
 * react-native-web не реализует Alert.alert (пустая заглушка, колбэки не срабатывают) —
 * на web используем window.confirm, на native — обычный Alert.alert с кнопками.
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  cancelLabel: string
): Promise<boolean> {
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
