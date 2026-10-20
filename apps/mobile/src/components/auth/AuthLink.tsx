import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

/** Переход между входом и регистрацией: «вопрос? **действие**», цель нажатия ≥ 48 px по всей строке. */
export function AuthLink({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${prompt} ${action}`} style={styles.row}>
      <Text style={[styles.prompt, { color: theme.colors.textMuted }]}>
        {prompt}{" "}
        <Text style={[styles.action, { color: theme.colors.primary }]}>{action}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8, cursor: "pointer" } as object,
  prompt: { fontSize: 14.5 },
  action: { fontWeight: "700" },
});
