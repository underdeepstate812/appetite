import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useUniqueId } from "../hooks/useUniqueId";

const SIZE = 64;

/**
 * Значок "заказ принят": градиентный диск с галочкой и двумя кольцами, которые
 * по очереди расходятся от него, как круги по воде. Спокойный вариант праздничного
 * CelebrationBurst — живёт на экране подтверждения, пока пользователь смотрит на билет.
 */
export function AcceptedBadge() {
  const uid = useUniqueId("accepted");
  const theme = useTheme();
  const reduced = useReducedMotion();
  const wave = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) return;
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 14 }).start();
    const loop = Animated.loop(Animated.timing(wave, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduced, wave, pop]);

  const dark = theme.mode === "dark";
  const ring = (delay: number) => ({
    opacity: wave.interpolate({ inputRange: [delay, delay + 0.12, Math.min(1, delay + 0.6)], outputRange: [0, 0.5, 0], extrapolate: "clamp" as const }),
    transform: [{ scale: wave.interpolate({ inputRange: [delay, Math.min(1, delay + 0.6)], outputRange: [1, 1.9], extrapolate: "clamp" as const }) }],
  });

  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.ring, { borderColor: theme.colors.primary }, ring(0)]} />
      <Animated.View style={[styles.ring, { borderColor: theme.colors.ember }, ring(0.3)]} />
      <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 88 88">
          <Defs>
            <LinearGradient id={`${uid}-acceptedDisc`} x1="8" y1="6" x2="80" y2="84" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={dark ? "#99f6e4" : "#2dd4bf"} />
              <Stop offset="1" stopColor={dark ? "#2dd4bf" : "#0f766e"} />
            </LinearGradient>
          </Defs>
          <Circle cx="44" cy="44" r="42" fill="url(#${uid}-acceptedDisc)" />
          <Circle cx="44" cy="44" r="41" fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.5} />
          <Path d="M27 44 L39 56 L61 32" fill="none" stroke={dark ? "#04211d" : "#ffffff"} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  ring: { position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2 },
});
