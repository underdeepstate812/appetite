import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse } from "react-native-svg";
import { AppetiteMark } from "../icons/AppetiteMark";

interface PinBeaconProps {
  /** Высота знака; сцена (круг, тень) масштабируется от неё. */
  size?: number;
  /** Покачивание знака и круг-«пинг» от острия. Без анимации (reduce motion) — тот же кадр, но статичный. */
  animate?: boolean;
}

/**
 * Знак Appetite как маяк на карте: пин «парит» над землёй, под ним тень сжимается на подъёме, а от острия
 * расходится плоский круг — как «пинг» геопозиции. Один образ для заставки и приветственной страницы: переход
 * между ними — тот же знак на том же месте, а не новая картинка. Только transform/opacity на native driver.
 */
export function PinBeacon({ size = 92, animate = true }: PinBeaconProps) {
  const bob = useRef(new Animated.Value(0)).current;
  const ping = useRef(new Animated.Value(0)).current;
  const stage = Math.round(size * 1.83);

  useEffect(() => {
    if (!animate) return;
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(Animated.timing(ping, { toValue: 1, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [animate, bob, ping]);

  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.076] });
  const shadowScale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] });
  const pingScale = ping.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.7] });
  const pingOpacity = ping.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] });

  return (
    <View style={{ width: stage, height: stage, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
      <View style={[styles.ground, { paddingTop: size * 0.62 }]}>
        {animate ? (
          <Animated.View style={{ opacity: pingOpacity, transform: [{ scale: pingScale }, { scaleY: 0.4 }] }}>
            <Svg width={stage} height={stage} viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r="44" fill="none" stroke="#5eead4" strokeWidth={2.2} />
            </Svg>
          </Animated.View>
        ) : (
          <View style={{ transform: [{ scaleY: 0.4 }], opacity: 0.22 }}>
            <Svg width={stage} height={stage} viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r="30" fill="none" stroke="#5eead4" strokeWidth={2.2} />
            </Svg>
          </View>
        )}
        <Animated.View style={[styles.shadow, { bottom: stage / 2 - size * 0.62 - 6, transform: [{ scaleX: shadowScale }] }]}>
          <Svg width={size * 0.56} height={size * 0.15} viewBox="0 0 52 14">
            <Ellipse cx="26" cy="7" rx="22" ry="5" fill="#001a17" opacity={0.45} />
          </Svg>
        </Animated.View>
      </View>
      <Animated.View style={{ transform: [{ translateY: bobY }] }}>
        <AppetiteMark size={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  shadow: { position: "absolute" },
});
