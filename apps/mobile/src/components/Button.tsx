import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { playHaptic } from "../utils/haptics";

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "dangerSoft";
  /** "success" — одиночное "успешно" (например, сохранение); "light" — короткий щелчок. Праздничные партитуры играют экраны, а не кнопка. */
  haptic?: "light" | "success" | "none";
}

/**
 * Тактильная кнопка (мягкий прямоугольник, не капсула). Основная — выпуклая: внутренний блик по верхней кромке,
 * нижняя "фаска" и цветное свечение под ней; при нажатии проседает пружиной и даёт
 * haptic. Вторичная — наоборот, вдавленная лунка без рамки; опасная — тонированная
 * с нижней фаской (сплошной красный только у самой нужной кнопки). Подпись — display-гарнитурой.
 */
export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  haptic = "light",
}: ButtonProps) {
  const theme = useTheme();
  const dark = theme.mode === "dark";
  const isDisabled = disabled || loading;
  const solid = variant === "primary" || variant === "danger";

  const fill = variant === "danger" ? theme.colors.danger : theme.colors.primary;
  const ink = variant === "danger" ? (dark ? "#2a0a07" : "#ffffff") : theme.colors.onPrimary;
  const textColor = solid ? ink : variant === "dangerSoft" ? theme.colors.danger : theme.colors.text;

  const pressAnim = useRef(new Animated.Value(0)).current;
  const animateTo = (toValue: number) =>
    Animated.spring(pressAnim, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  const handlePress = () => {
    if (isDisabled) return;
    if (haptic === "success") playHaptic("success");
    else if (haptic === "light") playHaptic("tap");
    onPress();
  };

  // Загрузка: вместо крутилки — короткий фитиль бежит по нижней кромке кнопки.
  const run = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading) return;
    const loop = Animated.loop(Animated.timing(run, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => {
      loop.stop();
      run.setValue(0);
    };
  }, [loading, run]);
  const runX = run.interpolate({ inputRange: [0, 1], outputRange: [-60, 260] });

  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] });
  const translateY = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 2] });

  return (
    <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => !isDisabled && animateTo(1)}
        onPressOut={() => animateTo(0)}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          styles.base,
          solid
            ? {
                backgroundColor: fill,
                boxShadow: `inset 0 1.5px 0 rgba(255,255,255,0.34), inset 0 -2px 0 rgba(0,0,0,0.14), 0 10px 24px ${fill}${dark ? "4d" : "59"}`,
              }
            : variant === "dangerSoft"
              ? { backgroundColor: theme.colors.dangerSoft, boxShadow: `inset 0 1px 0 rgba(255,255,255,${dark ? "0.06" : "0.7"}), inset 0 -2px 0 ${theme.colors.danger}33` }
              : // Вторичная — "вдавленная" лунка (не капсула с рамкой): тон поверхности и внутренняя тень сверху.
                {
                  backgroundColor: theme.colors.surface,
                  boxShadow: dark
                    ? "inset 0 2px 5px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.05)"
                    : "inset 0 2px 4px rgba(26,22,15,0.12), inset 0 -1px 0 rgba(255,255,255,0.8)",
                },
          { opacity: isDisabled ? 0.55 : 1, cursor: "pointer" },
        ]}
      >
        <Text style={[theme.fonts.bold, styles.text, { color: textColor, opacity: loading ? 0.7 : 1 }]}>{title}</Text>
        {loading ? (
          <View pointerEvents="none" style={styles.fuseClip}>
            <Animated.View style={[styles.fuse, { backgroundColor: textColor, transform: [{ translateX: runX }] }]} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  fuseClip: { position: "absolute", left: 22, right: 22, bottom: 7, height: 3, overflow: "hidden", borderRadius: 2 },
  fuse: { width: 60, height: 3, borderRadius: 2, opacity: 0.85 },
  text: { fontSize: 13.5, letterSpacing: 0.3 },
});
