import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { useTheme } from "../theme/ThemeProvider";
import { Button } from "./Button";

interface Props {
  children: React.ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Последняя линия обороны: исключение при рендере любого экрана раньше оставляло белый экран без
 * единого способа выйти. Теперь пользователь видит объяснение и кнопку "Повторить", которая
 * заново монтирует поддерево. Ошибку пишем в консоль — сюда же подключится крэш-репортинг.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  private reset = () => this.setState({ failed: false });

  render() {
    if (this.state.failed) return <Fallback onRetry={this.reset} />;
    return this.props.children;
  }
}

function Fallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]} accessibilityRole="alert">
      <View style={[styles.icon, { backgroundColor: theme.colors.emberSoft }]}>
        <TriangleAlert size={28} color={theme.colors.ember} strokeWidth={2.2} />
      </View>
      <Text style={[theme.typography.h2, styles.title, { color: theme.colors.text }]}>{t("common.error")}</Text>
      <Text style={[theme.typography.body, styles.hint, { color: theme.colors.textMuted }]}>{t("common.errorBoundaryHint")}</Text>
      <View style={styles.action}>
        <Button title={t("common.retry")} onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { textAlign: "center" },
  hint: { textAlign: "center", marginTop: 8, maxWidth: 320 },
  action: { marginTop: 24, minWidth: 200 },
});
