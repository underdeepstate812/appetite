import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, type DimensionValue, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useUniqueId } from "../../hooks/useUniqueId";

/** Общий «бег» блика: один цикл на весь список, а не по циклу на каждую полоску. */
export function useShimmerProgress() {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [progress, reduced]);
  return { progress, reduced };
}

interface BoneProps {
  width: DimensionValue;
  height: number;
  radius?: number;
  progress: Animated.Value;
  reduced?: boolean;
}

/** Полоска-заглушка с бликом, который пробегает слева направо (Skeleton, 21st.dev). Без движения при reduced-motion. */
export function Bone({ width, height, radius = 8, progress, reduced = false }: BoneProps) {
  const theme = useTheme();
  const id = useUniqueId("bone");
  const [w, setW] = useState(0);
  const dark = theme.mode === "dark";
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} style={[styles.bone, { width, height, borderRadius: radius, backgroundColor: dark ? "rgba(255,255,255,0.07)" : "rgba(22,32,30,0.07)" }]}>
      {!reduced && w > 0 ? (
        <Animated.View style={[styles.sweep, { width: w * 0.6, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.6, w] }) }] }]}>
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={dark ? 0.12 : 0.65} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${id})`} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Строка списка заказов в виде заглушки: повторяет раскладку OrderRow, поэтому после загрузки ничего не «прыгает». */
export function OrderRowSkeleton({ progress, reduced }: { progress: Animated.Value; reduced: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: theme.radii.lg, marginBottom: theme.spacing.sm }]}>
      <Bone width={44} height={44} radius={22} progress={progress} reduced={reduced} />
      <View style={styles.lines}>
        <View style={styles.top}>
          <Bone width="58%" height={15} progress={progress} reduced={reduced} />
          <Bone width={52} height={15} progress={progress} reduced={reduced} />
        </View>
        <Bone width="36%" height={12} progress={progress} reduced={reduced} />
        <Bone width="48%" height={20} radius={10} progress={progress} reduced={reduced} />
      </View>
    </View>
  );
}

/** Заглушка списка заказов: один общий блик на все строки. Скринридеру — одна подпись «Загрузка». */
export function OrdersListSkeleton({ count = 4, label }: { count?: number; label: string }) {
  const { progress, reduced } = useShimmerProgress();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
      {Array.from({ length: count }, (_, i) => (
        <OrderRowSkeleton key={i} progress={progress} reduced={reduced} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: { overflow: "hidden" },
  sweep: { position: "absolute", top: 0, bottom: 0, left: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  lines: { flex: 1, gap: 8 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
});
