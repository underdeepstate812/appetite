import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

/**
 * Лёгкое появление карточки: opacity 0→1 + translateY 14→0, со сдвигом по
 * index (60мс между карточками) — тот самый "staggered card entrance",
 * которым flagship-приложения (DoorDash, Airbnb и т.п.) оживляют списки
 * при первой отрисовке, вместо мгновенного "хлопка" всех карточек разом.
 * Только opacity/transform + useNativeDriver — не блокирует поток.
 */
export function StaggerReveal({
  index,
  children,
  fill = false,
}: {
  index: number;
  children: React.ReactNode;
  /** Для ячеек сетки: растянуться по высоте строки, чтобы карточка заполнила её целиком. */
  fill?: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 6) * 60,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opacity = progress;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return <Animated.View style={[fill && { flexGrow: 1 }, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
