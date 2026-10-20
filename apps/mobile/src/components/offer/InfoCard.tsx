import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

/** Карточка-секция экрана оффера: поверхность темы, иконка и заголовок в одной строке. */
export function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
      <View style={styles.head}>
        {icon}
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.textMuted }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginTop: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
});
