import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { glassTokens } from "../../theme/glass";
import { useSlidingHighlight } from "../../hooks/useSlidingHighlight";
import { playHaptic } from "../../utils/haptics";

export interface GlassSegmentedOption<T extends string> {
  value: T;
  /** Видимая подпись; у варианта со значком — имя для скринридера (на экране не показывается). */
  label: string;
  /** Имя для скринридера, если оно отличается от видимой подписи («RU» → «Русский»). */
  a11yLabel?: string;
  /** Значок вместо подписи; получает цвет под активное/неактивное состояние. */
  icon?: (color: string) => React.ReactNode;
}

interface GlassSegmentedProps<T extends string> {
  options: GlassSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  /** Узкие сегменты 52 px и дорожка по размеру содержимого — для переключателей на значках (тема, язык). */
  compact?: boolean;
}

/**
 * Сегментный переключатель со скользящей стеклянной плашкой (LiquidRadio, 21st.dev): выбранный сегмент не просто
 * закрашивается — под ним переезжает «капля» стекла с подсвеченной кромкой и мятным свечением. Дорожка «вдавлена».
 * Касание ≥ 44 px; подписи остаются текстом, скринридер видит radiogroup и состояние каждого сегмента.
 */
export function GlassSegmented<T extends string>({ options, value, onChange, accessibilityLabel, compact = false }: GlassSegmentedProps<T>) {
  const theme = useTheme();
  const dark = theme.mode === "dark";
  const g = glassTokens(theme.mode, "mint");
  const { pos, size, ready, onItemLayout } = useSlidingHighlight(value, "x");

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        compact && styles.trackCompact,
        {
          backgroundColor: dark ? "rgba(255, 255, 255, 0.05)" : "rgba(22, 32, 30, 0.06)",
          borderRadius: theme.radii.md,
          boxShadow: dark ? "inset 0 1px 3px rgba(0, 0, 0, 0.45)" : "inset 0 1px 3px rgba(22, 32, 30, 0.14)",
        },
      ]}
    >
      {ready ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: pos,
              width: size,
              borderRadius: theme.radii.sm + 2,
              backgroundColor: dark ? "rgba(45, 212, 191, 0.16)" : "rgba(255, 255, 255, 0.92)",
              borderColor: dark ? "rgba(94, 234, 212, 0.38)" : "rgba(15, 118, 110, 0.20)",
              boxShadow: dark
                ? "inset 0 1px 0 rgba(184, 251, 239, 0.32), 0 4px 16px rgba(45, 212, 191, 0.22)"
                : "inset 0 1px 0 rgba(255, 255, 255, 1), 0 4px 14px rgba(15, 118, 110, 0.18)",
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onLayout={onItemLayout(option.value)}
            onPress={() => {
              if (active) return;
              playHaptic("select");
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={option.a11yLabel ?? option.label}
            aria-checked={active}
            accessibilityState={{ checked: active }}
            style={[styles.segment, compact && styles.segmentCompact, { cursor: "pointer" } as object]}
          >
            {option.icon ? (
              option.icon(active ? (dark ? g.accent : theme.colors.primary) : theme.colors.textMuted)
            ) : (
              <Text style={[styles.label, { color: active ? (dark ? g.accent : theme.colors.primary) : theme.colors.textMuted, fontWeight: active ? "700" : "600" }]}>{option.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 4 },
  trackCompact: { alignSelf: "flex-start" },
  thumb: { position: "absolute", top: 4, bottom: 4, borderWidth: 1 },
  // minHeight 44 — минимальный touch-таргет (iOS HIG), как у прежнего SegmentedControl.
  segment: { flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 },
  // flex: 0 в RN-web даёт flex-basis: 0 и «съедает» width — поэтому grow/shrink/basis заданы явно, все три.
  segmentCompact: { flexGrow: 0, flexShrink: 0, flexBasis: 52, width: 52, paddingHorizontal: 0 },
  label: { fontSize: 14 },
});
