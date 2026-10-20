import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { PinBeacon } from "./PinBeacon";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useUniqueId } from "../../hooks/useUniqueId";
import { SPLASH_MIN_MS, SPLASH_MIN_MS_REDUCED, remainingSplashMs } from "../../utils/boot";

/** Фон заставки совпадает с цветом нативной заставки (app.json → expo-splash-screen): переход между ними незаметен. */
export const SPLASH_BG = "#052e2b";
const MARK = 104;

interface BootSplashProps {
  /** Приложение готово показать экран: шрифты загружены, сессия проверена. */
  ready: boolean;
  /** Заставка полностью ушла (для тестов и для того, кто хочет знать). */
  onDone?: () => void;
}

/**
 * Заставка с нашим знаком. Пин «парит» над картой: мягко покачивается, а от его острия расходится круг, как «пинг»
 * геопозиции, — знак сам объясняет, что приложение про места рядом. Показывается с первого кадра (до темы и шрифтов,
 * поэтому у неё свои цвета), держится минимум ~0,9 с, чтобы не мигать, и уходит, когда приложение готово: знак чуть
 * вырастает и растворяется. «Уменьшить движение» — без качания и кругов, только короткое появление и исчезновение.
 */
export function BootSplash({ ready, onDone }: BootSplashProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const uid = useUniqueId("boot");
  const [gone, setGone] = useState(false);
  const shownAt = useRef(Date.now());

  const intro = useRef(new Animated.Value(0)).current; // знак: появление
  const word = useRef(new Animated.Value(0)).current; // подпись
  const exit = useRef(new Animated.Value(0)).current; // уход

  useEffect(() => {
    Animated.parallel([
      Animated.spring(intro, { toValue: 1, useNativeDriver: true, speed: reduced ? 40 : 11, bounciness: reduced ? 0 : 9 }),
      Animated.timing(word, { toValue: 1, duration: 360, delay: reduced ? 0 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [reduced, intro, word]);

  // Готово — ждём остаток минимума и уходим.
  useEffect(() => {
    if (!ready || gone) return;
    const wait = remainingSplashMs(Date.now() - shownAt.current, reduced ? SPLASH_MIN_MS_REDUCED : SPLASH_MIN_MS);
    const timer = setTimeout(() => {
      Animated.timing(exit, { toValue: 1, duration: reduced ? 160 : 340, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => {
        setGone(true);
        onDone?.();
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [ready, gone, reduced, exit, onDone]);

  // Нативную заставку убираем, когда наша уже нарисована (тот же фон и знак — подмены не видно).
  const handleLayout = () => {
    void SplashScreen.hideAsync().catch(() => {});
  };

  if (gone) return null;

  const markScale = Animated.multiply(
    intro.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] }),
    exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] })
  );
  const markOpacity = Animated.multiply(intro, exit.interpolate({ inputRange: [0, 0.8], outputRange: [1, 0], extrapolate: "clamp" }));
  const overlayOpacity = exit.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1, 0] });
  const wordY = word.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[styles.root, { opacity: overlayOpacity }]}
      pointerEvents={ready ? "none" : "auto"}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Appetite — ${t("common.loading")}`}
      accessibilityLiveRegion="polite"
    >
      <StatusBar style="light" />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 360 640">
        <Defs>
          <RadialGradient id={`${uid}-mint`} cx="90" cy="150" r="340" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#2dd4bf" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#2dd4bf" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${uid}-ember`} cx="300" cy="590" r="250" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#ff8a3d" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#ff8a3d" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="360" height="640" fill={`url(#${uid}-mint)`} />
        <Rect width="360" height="640" fill={`url(#${uid}-ember)`} />
      </Svg>

      <View style={styles.center}>
        <Animated.View style={{ opacity: markOpacity, transform: [{ scale: markScale }] }}>
          <PinBeacon size={MARK} animate={!reduced} />
        </Animated.View>
        <Animated.Text style={[styles.word, { opacity: Animated.multiply(word, exit.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: "clamp" })), transform: [{ translateY: wordY }] }]}>
          Appetite
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: SPLASH_BG, zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 36 },
  // Подпись — системным жирным, не Unbounded: заставка рисуется ДО загрузки шрифтов, подмена начертания была бы видна.
  word: { marginTop: -4, fontSize: 24, fontWeight: "800", letterSpacing: -0.3, color: "#ffffff" },
});
