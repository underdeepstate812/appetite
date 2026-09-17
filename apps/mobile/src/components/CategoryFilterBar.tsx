import React, { useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { OfferCategory } from "@apetite/shared";
import { useTheme } from "../theme/ThemeProvider";

interface CategoryOption {
  value: OfferCategory | undefined;
  label: string;
}

interface CategoryFilterBarProps {
  categories: CategoryOption[];
  value: OfferCategory | undefined;
  onChange: (value: OfferCategory | undefined) => void;
}

export function CategoryFilterBar({ categories, value, onChange }: CategoryFilterBarProps) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {categories.map((category) => (
        <CategoryChip
          key={category.label}
          label={category.label}
          active={category.value === value}
          onPress={() => onChange(category.value)}
        />
      ))}
    </ScrollView>
  );
}

/** Лёгкий press-scale (та же пружина, что и у Button) — чипы фильтра до сих пор были совсем без тактильного отклика. */
function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(0.93)}
        onPressOut={() => animateTo(1)}
        style={[
          styles.chip,
          {
            borderRadius: theme.radii.full,
            backgroundColor: active ? theme.colors.primary : theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text
          style={{
            color: active ? theme.colors.onPrimary : theme.colors.text,
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
});
