import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Check from "lucide-react-native/icons/check";
import { useTheme } from "../../theme/ThemeProvider";
import { glassTokens } from "../../theme/glass";
import { useSlidingHighlight } from "../../hooks/useSlidingHighlight";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { playHaptic } from "../../utils/haptics";

export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  /** Значок слева; получает цвет под выбранное/невыбранное состояние. */
  icon?: (color: string) => React.ReactNode;
}

interface RadioCardsProps<T extends string> {
  options: RadioCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Имя группы для скринридера: видимая подпись обычно лежит снаружи. */
  groupLabel?: string;
}

/**
 * Радио-карточки с одной скользящей стеклянной плашкой выбора. Решение собрано из двух компонентов 21st.dev:
 * LiquidRadio (плашка «переезжает» между вариантами по кривой 0.16/1/0.3/1, кромка подсвечена) и Icon Card Radio Group
 * (карточка с описанием и отметкой, которая «выскакивает» пружиной). Код не заимствован — перенесены решение и поведение.
 * Плашка полупрозрачная и лежит поверх карточек: сами карточки статичны, поэтому при переезде ничего не мигает.
 */
export function RadioCards<T extends string>({ options, value, onChange, groupLabel }: RadioCardsProps<T>) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const g = glassTokens(theme.mode, "mint");
  const dark = theme.mode === "dark";
  const { pos, size, ready, onItemLayout } = useSlidingHighlight(value, "y");

  const pops = useRef(new Map<string, Animated.Value>());
  const popOf = (key: string) => {
    let v = pops.current.get(key);
    if (!v) {
      v = new Animated.Value(key === value ? 1 : 0);
      pops.current.set(key, v);
    }
    return v;
  };
  useEffect(() => {
    options.forEach((option) => {
      const v = popOf(option.value);
      const target = option.value === value ? 1 : 0;
      if (reduced) v.setValue(target);
      else if (target === 1) Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 10 }).start();
      else Animated.timing(v, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  return (
    <View style={styles.stack} accessibilityRole="radiogroup" accessibilityLabel={groupLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        const pop = popOf(option.value);
        return (
          <Pressable
            key={option.value}
            onLayout={onItemLayout(option.value)}
            onPress={() => {
              if (selected) return;
              playHaptic("select");
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={option.hint ? `${option.label}. ${option.hint}` : option.label}
            // aria-checked — для web: RN-web не переносит accessibilityState.checked в DOM, и у radio не было бы состояния.
            aria-checked={selected}
            accessibilityState={{ checked: selected }}
            style={[
              styles.row,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, cursor: "pointer" } as object,
            ]}
          >
            {option.icon ? (
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceElevated }]}>{option.icon(selected ? g.accent : theme.colors.textMuted)}</View>
            ) : null}
            <View style={styles.labels}>
              <Text style={[styles.label, { color: theme.colors.text, fontWeight: selected ? "700" : "600" }]}>{option.label}</Text>
              {option.hint ? <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{option.hint}</Text> : null}
            </View>
            <View style={[styles.ring, { borderColor: theme.colors.border }]}>
              <Animated.View
                style={[
                  styles.badge,
                  { backgroundColor: theme.colors.primary, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
                ]}
              >
                <Check size={13} color={theme.colors.onPrimary} strokeWidth={3.2} />
              </Animated.View>
            </View>
          </Pressable>
        );
      })}

      {ready ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pane,
            {
              top: pos,
              height: size,
              borderRadius: theme.radii.lg,
              borderColor: g.accent,
              backgroundColor: dark ? "rgba(45, 212, 191, 0.10)" : "rgba(15, 118, 110, 0.07)",
              // кромка стекла: светлая линия по верхнему краю + мягкое свечение вокруг (как у LiquidRadio, в нашей мяте)
              boxShadow: dark
                ? "inset 0 1px 0 rgba(184, 251, 239, 0.30), 0 0 0 1px rgba(45, 212, 191, 0.10), 0 10px 28px rgba(45, 212, 191, 0.20)"
                : "inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 8px 24px rgba(15, 118, 110, 0.16)",
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1.5, minHeight: 60 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: 12 },
  labels: { flex: 1 },
  label: { fontSize: 15, lineHeight: 20 },
  hint: { fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", margin: -2 },
  pane: { position: "absolute", left: 0, right: 0, borderWidth: 1.5 },
});
