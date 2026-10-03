import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { Button } from "./Button";

export function LoadingView({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={[styles.text, { color: theme.colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function EmptyView({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.text, { color: theme.colors.textMuted }]}>{label}</Text>
    </View>
  );
}

/** Ошибка загрузки; с onRetry появляется кнопка "Повторить" — иначе после сбоя сети выхода нет, кроме перезапуска. */
export function ErrorView({ label, onRetry }: { label: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.text, { color: theme.colors.danger }]}>{label}</Text>
      {onRetry ? (
        <View style={styles.retry}>
          <Button title={t("common.retry")} variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  text: { marginTop: 8, fontSize: 14, textAlign: "center" },
  retry: { marginTop: 16, minWidth: 180 },
});
