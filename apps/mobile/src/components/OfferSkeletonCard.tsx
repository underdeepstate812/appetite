import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
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
    drawLoop.start();
    pulseLoop.start();
    return () => {
      drawLoop.stop();
      pulseLoop.stop();
    };
  }, [draw, pulse]);

  const strokeDashoffset = draw.interpolate({
    inputRange: [0, 1],
    outputRange: [PLATE_CIRCUMFERENCE, 0],
  });

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated, borderRadius: theme.radii.lg, borderColor: theme.colors.border }]}>
      <View style={styles.plateWrap}>
        <Svg width={56} height={56} viewBox="0 0 56 56">
          <Circle cx="28" cy="28" r="22" stroke={theme.colors.border} strokeWidth={2} fill="none" />
          <AnimatedCircle
            cx="28"
            cy="28"
            r="22"
            stroke={theme.colors.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={PLATE_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            rotation={-90}
            origin="28, 28"
          />
          <Line x1="12" y1="14" x2="12" y2="24" stroke={theme.colors.border} strokeWidth={1.5} strokeLinecap="round" />
          <Line x1="44" y1="14" x2="44" y2="24" stroke={theme.colors.border} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      </View>
      <Animated.View style={[styles.bar, styles.barTitle, { backgroundColor: theme.colors.border, opacity: pulse }]} />
      <Animated.View style={[styles.bar, styles.barSubtitle, { backgroundColor: theme.colors.border, opacity: pulse }]} />
      <Animated.View style={[styles.bar, styles.barPrice, { backgroundColor: theme.colors.border, opacity: pulse }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderWidth: 1, alignItems: "center", minHeight: 168, justifyContent: "center" },
  plateWrap: { marginBottom: 14 },
  bar: { height: 8, borderRadius: 4, alignSelf: "stretch" },
  barTitle: { marginBottom: 8, width: "80%", alignSelf: "center" },
  barSubtitle: { marginBottom: 12, width: "55%", alignSelf: "center" },
  barPrice: { width: "40%", alignSelf: "center" },
});
