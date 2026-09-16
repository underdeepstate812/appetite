import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

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

export function ErrorView({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.text, { color: theme.colors.danger }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  text: { marginTop: 8, fontSize: 14, textAlign: "center" },
});
