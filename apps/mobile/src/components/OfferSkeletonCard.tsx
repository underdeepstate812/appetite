import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

const PLATE_CIRCUMFERENCE = 2 * Math.PI * 22;

/**
 * Скелетная загрузка вместо крутящегося спиннера: контур тарелки "дорисовывается"
 * светящейся линией (stroke-dashoffset 0→circumference→0 по кругу), а под ним
 * пульсируют плейсхолдер-полоски текста — подогревает ожидание вместо генерик
 * кольца-лоадера (см. бриф про "скелетную микро-анимацию блюд").
 */
export function OfferSkeletonCard() {
  const theme = useTheme();
  const draw = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.4)).current;
  // react-native-svg на web не до конца фильтрует RN-специфичные пропы
  // (collapsable, transform-origin), которые Animated.createAnimatedComponent(Circle)
  // прокидывает в DOM — ведём strokeDashoffset обычным React state по тику анимации.
  const [strokeDashoffset, setStrokeDashoffset] = useState(PLATE_CIRCUMFERENCE);

  useEffect(() => {
    const drawLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(draw, { toValue: 1, duration: 1400, useNativeDriver: false }),
        Animated.timing(draw, { toValue: 0, duration: 600, useNativeDriver: false }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    const listenerId = draw.addListener(({ value }) => {
      setStrokeDashoffset(PLATE_CIRCUMFERENCE * (1 - value));
    });
    drawLoop.start();
    pulseLoop.start();
    return () => {
      drawLoop.stop();
      pulseLoop.stop();
      draw.removeListener(listenerId);
    };
  }, [draw, pulse]);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surfaceElevated, borderRadius: theme.radii.lg, borderColor: theme.colors.border },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: theme.colors.surface, borderRadius: 12 }]}>
        <Svg width={44} height={44} viewBox="0 0 56 56">
          <Circle cx="28" cy="28" r="22" stroke={theme.colors.border} strokeWidth={2} fill="none" />
          <Circle
            cx="28"
            cy="28"
            r="22"
            stroke={theme.colors.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={PLATE_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 28 28)"
          />
          <Line x1="12" y1="14" x2="12" y2="24" stroke={theme.colors.border} strokeWidth={1.5} strokeLinecap="round" />
          <Line x1="44" y1="14" x2="44" y2="24" stroke={theme.colors.border} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      </View>
      <View style={styles.bars}>
        <Animated.View style={[styles.bar, { width: "75%", backgroundColor: theme.colors.border, opacity: pulse }]} />
        <Animated.View style={[styles.bar, { width: "50%", backgroundColor: theme.colors.border, opacity: pulse }]} />
        <Animated.View style={[styles.bar, { width: "35%", backgroundColor: theme.colors.border, opacity: pulse }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 10, paddingBottom: 18, borderWidth: 1 },
  thumb: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  bars: { flex: 1, gap: 8 },
  bar: { height: 8, borderRadius: 4 },
});
