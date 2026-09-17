import React, { useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeProvider";

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  /** "success" — двойной плотный вибро-клик для необратимых/радостных действий (см. бриф: "клик-клак" при подтверждении заказа). */
  haptic?: "light" | "success" | "none";
}

/**
 * Тактильная ("clay") кнопка — третье поколение стиля кнопок в проекте
 * (было: плоская Pressable с opacity → это: мягкая приподнятая форма с
 * двойной тенью и анимацией "вдавливания" при нажатии + настоящий haptic-
 * отклик). Не liquid-glass с sheen (это стиль web), не плоский hard-shadow —
 * самостоятельное, физическое ощущение "нажимаемости".
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
  const isDisabled = disabled || loading;
  const isPrimary = variant === "primary";
  const backgroundColor = isPrimary ? theme.colors.primary : theme.colors.surfaceElevated;
  const textColor = isPrimary ? theme.colors.onPrimary : theme.colors.primary;

  const pressAnim = useRef(new Animated.Value(0)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(pressAnim, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };

  const handlePressIn = () => {
    if (isDisabled) return;
    animateTo(1);
  };

  const handlePressOut = () => animateTo(0);

  const handlePress = () => {
    if (isDisabled) return;
    if (haptic === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (haptic === "light") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });
  const translateY = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 2] });

  return (
    <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={[
          styles.base,
          {
            backgroundColor,
            borderRadius: theme.radii.lg,
            opacity: isDisabled ? 0.55 : 1,
          },
          isPrimary ? shadowFor(theme.colors.primary) : shadowFor("#000000", 0.12),
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <Text style={[styles.text, { color: textColor }]}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

function shadowFor(color: string, opacity = 0.35) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: opacity,
    shadowRadius: 14,
    elevation: 6,
  };
}

const styles = StyleSheet.create({
  base: { paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 16, fontWeight: "700" },
});
