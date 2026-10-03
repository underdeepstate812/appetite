import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeProvider";

const ITEM_W = 46;
const ITEM_H = 38;
const PAD = 3;

export interface SlideSwitchOption<T extends string> {
  value: T;
  /** Для скринридера — вместо видимой подписи (в переключателе только значки). */
  accessibilityLabel: string;
  /** Содержимое ячейки; получает цвет, подходящий под активное/неактивное состояние. */
  render: (color: string) => React.ReactNode;
}

interface SlideSwitchProps<T extends string> {
  options: SlideSwitchOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Компактный переключатель на значках: бегунок плавно "переезжает"
 * к выбранной ячейке (spring на native driver). Заменяет широкий SegmentedControl там,
 * где вариантов 2–3 и подпись не нужна — экономит вертикаль, оставляя touch-таргет 46×38.
 */
export function SlideSwitch<T extends string>({ options, value, onChange }: SlideSwitchProps<T>) {
  const theme = useTheme();
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const position = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.spring(position, { toValue: index, useNativeDriver: true, speed: 28, bounciness: 2 }).start();
  }, [index, position]);

  const translateX = position.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => i * ITEM_W),
  });

  return (
    <View
      accessibilityRole="radiogroup"
      style={[
        styles.track,
        { backgroundColor: theme.colors.background, borderColor: theme.colors.border, width: options.length * ITEM_W + PAD * 2 + 2 },
      ]}
    >
      <Animated.View style={[styles.thumb, { backgroundColor: theme.colors.primary, transform: [{ translateX }] }]} />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            aria-checked={active}
            accessibilityLabel={option.accessibilityLabel}
            onPress={() => {
              if (!active) Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
            style={[styles.item, { cursor: "pointer" }]}
          >
            {option.render(active ? theme.colors.onPrimary : theme.colors.textMuted)}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: PAD, borderWidth: 1, borderRadius: 16 },
  thumb: { position: "absolute", left: PAD + 1, top: PAD + 1, width: ITEM_W, height: ITEM_H, borderRadius: 12, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 3px 10px rgba(15,118,110,0.35)" },
  item: { width: ITEM_W, height: ITEM_H, alignItems: "center", justifyContent: "center" },
});
