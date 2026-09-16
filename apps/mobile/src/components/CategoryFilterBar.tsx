import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
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
      {categories.map((category) => {
        const active = category.value === value;
        return (
          <Pressable
            key={category.label}
            onPress={() => onChange(category.value)}
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
              {category.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
});
