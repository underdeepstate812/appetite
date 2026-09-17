import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeProvider";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!active) Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
            style={[styles.segment, { borderRadius: theme.radii.sm }, active && { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.label, { color: active ? theme.colors.onPrimary : theme.colors.textMuted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", padding: 4 },
  // minHeight 44 — минимальный touch-таргет (Fitts' law / iOS HIG), не только вертикальный паддинг.
  segment: { flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 14, fontWeight: "600" },
});
