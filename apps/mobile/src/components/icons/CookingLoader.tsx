import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";
import { FryingPanIcon } from "./FryingPanIcon";

interface CookingLoaderProps {
  size?: number;
}

/**
 * "Готовим твой заказ" — анимация на экран оформления/оплаты: кусочек еды
 * подпрыгивает на сковороде (жарка), пар поднимается двумя штрихами со сдвигом
 * по фазе. Только transform/opacity + useNativeDriver — тот же принцип, что и
 * в OrderStatusTimeline, без просадки кадров ни на native, ни на web.
 */
export function CookingLoader({ size = 96 }: CookingLoaderProps) {
  const theme = useTheme();
  const hop = useRef(new Animated.Value(0)).current;
  const steam1 = useRef(new Animated.Value(0)).current;
  const steam2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const hopLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(hop, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    const steamLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(steam1, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(steam1, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    const steamLoop2 = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(steam2, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(steam2, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    hopLoop.start();
    steamLoop1.start();
    steamLoop2.start();
    return () => {
      hopLoop.stop();
      steamLoop1.stop();
      steamLoop2.stop();
    };
  }, [hop, steam1, steam2]);

  const hopTranslate = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.16] });
  const hopScaleY = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });
  const steam1Translate = steam1.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.22] });
  const steam2Translate = steam2.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.22] });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[styles.steam, { left: size * 0.28, opacity: steam1, transform: [{ translateY: steam1Translate }] }]}
      >
        <Svg width={size * 0.16} height={size * 0.16} viewBox="0 0 24 24">
          <Path d="M6 20 Q10 12 6 4" stroke={theme.colors.textMuted} strokeWidth={2} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[styles.steam, { left: size * 0.5, opacity: steam2, transform: [{ translateY: steam2Translate }] }]}
      >
        <Svg width={size * 0.16} height={size * 0.16} viewBox="0 0 24 24">
          <Path d="M6 20 Q10 12 6 4" stroke={theme.colors.textMuted} strokeWidth={2} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          top: size * 0.24,
          left: size * 0.3,
          transform: [{ translateY: hopTranslate }, { scaleY: hopScaleY }],
        }}
      >
        <Svg width={size * 0.22} height={size * 0.22} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9} fill={theme.colors.warning} />
        </Svg>
      </Animated.View>

      <View style={styles.pan}>
        <FryingPanIcon size={size * 0.85} color={theme.colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  pan: { position: "absolute", bottom: 0 },
  steam: { position: "absolute", top: 0 },
});
