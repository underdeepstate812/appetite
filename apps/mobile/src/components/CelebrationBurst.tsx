import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { SparkBurst } from "./SparkBurst";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const CHECK_PATH = "M27 44 L39 56 L61 32";
const CHECK_LENGTH = 52;
const RING_R = 42;
const RING_LENGTH = 2 * Math.PI * RING_R;
/** Момент "замка": кольцо замкнулось. Совпадает с партитурой playHaptic("confirm") (rigid @360). */
const LOCK_AT = 360;

interface CelebrationBurstProps {
  /** Сторона квадрата, в котором живёт значок; искры вылетают за его границы. */
  size?: number;
  onDone?: () => void;
}

/**
 * Оплата подтверждена — жар зажёгся. 60–360 мс кольцо дорисовывается по кругу; на 360 оно
 * "защёлкивается": внутри вспыхивает диск, дорисовывается галочка, расходятся две волны и
 * вверх поднимаются искры. Тайминги совпадают с haptic "confirm": удар на замыкании кольца.
 * При включённом "уменьшении движения" — статичный диск с готовой галочкой.
 */
export function CelebrationBurst({ size = 240, onDone }: CelebrationBurstProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const ringDraw = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const disc = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const checkDraw = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      onDone?.();
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(ringDraw, { toValue: 1, duration: 300, delay: 60, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.sequence([Animated.delay(LOCK_AT), Animated.spring(disc, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 10 })]),
      Animated.timing(checkDraw, { toValue: 1, duration: 260, delay: LOCK_AT, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(wave, { toValue: 1, duration: 1000, delay: LOCK_AT, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onDone?.();
    });
    return () => animation.stop();
    // Партитура играется один раз на монтирование.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const dark = theme.mode === "dark";
  const discSize = Math.round(size * 0.4);
  const center = size / 2;

  const waveStyle = (offset: number) => ({
    opacity: wave.interpolate({ inputRange: [offset, offset + 0.1, Math.min(1, offset + 0.7)], outputRange: [0, 0.5, 0], extrapolate: "clamp" as const }),
    transform: [{ scale: wave.interpolate({ inputRange: [offset, Math.min(1, offset + 0.7)], outputRange: [0.4, 2.2], extrapolate: "clamp" as const }) }],
  });

  return (
    <View style={{ width: size, height: size }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.fill, { opacity: glow }]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="celebGlow" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={theme.colors.primary} stopOpacity={dark ? 0.3 : 0.2} />
              <Stop offset="1" stopColor={theme.colors.primary} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#celebGlow)" />
        </Svg>
      </Animated.View>

      {[0, 0.12].map((offset, index) => (
        <Animated.View
          key={offset}
          style={[
            styles.wave,
            { width: discSize, height: discSize, left: center - discSize / 2, top: center - discSize / 2, borderRadius: discSize / 2, borderColor: index === 0 ? "#b8fbef" : theme.colors.primary },
            waveStyle(offset),
          ]}
        />
      ))}

      <View style={{ position: "absolute", left: center - discSize / 2, top: center - discSize / 2, width: discSize, height: discSize }}>
        <Svg width={discSize} height={discSize} viewBox="0 0 88 88">
          <Defs>
            <LinearGradient id="celebRing" x1="4" y1="44" x2="84" y2="44" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#2dd4bf" />
              <Stop offset="1" stopColor="#b8fbef" />
            </LinearGradient>
            <LinearGradient id="celebDisc" x1="8" y1="6" x2="80" y2="84" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={dark ? "#99f6e4" : "#2dd4bf"} />
              <Stop offset="1" stopColor={dark ? "#2dd4bf" : "#0f766e"} />
            </LinearGradient>
          </Defs>
          <AnimatedCircle
            cx="44"
            cy="44"
            r={RING_R}
            fill="none"
            stroke="url(#celebRing)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={ringDraw.interpolate({ inputRange: [0, 1], outputRange: [RING_LENGTH, 0] })}
            rotation={-90}
            origin="44, 44"
          />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: disc, transform: [{ scale: disc.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
          <Svg width={discSize} height={discSize} viewBox="0 0 88 88">
            <Circle cx="44" cy="44" r="38" fill="url(#celebDisc)" />
            <AnimatedPath
              d={CHECK_PATH}
              fill="none"
              stroke={dark ? "#04211d" : "#ffffff"}
              strokeWidth={5.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={CHECK_LENGTH}
              strokeDashoffset={checkDraw.interpolate({ inputRange: [0, 1], outputRange: [CHECK_LENGTH, 0] })}
            />
          </Svg>
        </Animated.View>
      </View>

      <View style={{ position: "absolute", left: center, top: center, width: 0, height: 0 }}>
        <SparkBurst count={24} delay={LOCK_AT} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  wave: { position: "absolute", borderWidth: 2 },
});
