import React from "react";
import { StyleSheet, Text, View } from "react-native";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import { useTheme } from "../../theme/ThemeProvider";

/** Ошибка сервера (неверный пароль, занятый email, нет сети) — заметный блок над кнопкой, а не мелкая строка. */
export function AuthError({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="assertive"
      style={[styles.box, { backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radii.md }]}
    >
      <CircleAlert size={18} color={theme.colors.danger} strokeWidth={2.4} style={styles.icon} />
      <Text accessibilityRole="alert" style={[styles.text, { color: theme.colors.danger }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  icon: { marginTop: 1 },
  text: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "600" },
});
