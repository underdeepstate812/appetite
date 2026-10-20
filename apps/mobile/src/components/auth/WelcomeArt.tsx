import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from "react-native-svg";
import { DiscountStamp, STICKER_FILL } from "../DiscountStamp";
import { heatBand } from "../../theme/heat";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useUniqueId } from "../../hooks/useUniqueId";
import { WelcomeCityMap } from "./WelcomeCityMap";

interface ChipSpec {
  percent: number;
  /** Жар окна: красит наклейку (спокойный → янтарь → ember → красный) — тот же язык, что у карточек. */
  ratio: number;
  /** Положение центра наклейки в долях стороны арта. */
  x: number;
  y: number;
  tilt: number;
  /** Период покачивания, мс. */
  period: number;
  delay: number;
}

const CHIPS: ChipSpec[] = [
  { percent: 70, ratio: 0.86, x: 0.2, y: 0.24, tilt: -6, period: 3300, delay: 500 },
  { percent: 55, ratio: 0.62, x: 0.8, y: 0.17, tilt: 5, period: 4100, delay: 700 },
  { percent: 40, ratio: 0.36, x: 0.8, y: 0.72, tilt: -3, period: 3700, delay: 900 },
];

const MINT = "#5eead4";
const MINT_DEEP = "#2dd4bf";

/** Риски сторон света по кромке круга. */
const TICKS = [
  { x1: 50, y1: 0.8, x2: 50, y2: 3.6 },
  { x1: 50, y1: 96.4, x2: 50, y2: 99.2 },
  { x1: 0.8, y1: 50, x2: 3.6, y2: 50 },
  { x1: 96.4, y1: 50, x2: 99.2, y2: 50 },
];

/** Бесконечное медленное вращение 0→360° на native driver (без дёргания на стыке: 360° ≡ 0°). */
function useSpin(durationMs: number, enabled: boolean) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: durationMs, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [enabled, durationMs, spin]);
  return spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
}

/** Волна от точки: 0 → 1 за 2,8 с по кругу; delay сдвигает старт один раз (вторая волна идёт на полпериода позже). */
function useWave(enabled: boolean, delay: number) {
  const wave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) return;
    wave.setValue(0);
    const loop = Animated.sequence([Animated.delay(delay), Animated.loop(Animated.timing(wave, { toValue: 1, duration: 2800, easing: Easing.out(Easing.quad), useNativeDriver: true }))]);
    loop.start();
    return () => loop.stop();
  }, [enabled, delay, wave]);
  return {
    opacity: wave.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.6, 0] }),
    transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.18, 1] }) }],
  };
}

/**
 * Точка «вы здесь» в центре карты: мятная точка с белой каймой и две волны-круга, расходящиеся от неё по очереди, — как
 * геопозиция на настоящей карте. От неё начинается маршрут к скидке. Только чистые круги, никаких «клякс».
 */
function YouAreHere({ size, enabled }: { size: number; enabled: boolean }) {
  const first = useWave(enabled, 0);
  const second = useWave(enabled, 1400);
  const ringBox = size * 0.34;
  const dot = Math.max(10, size * 0.034) + 4;
  const ring = { position: "absolute", width: ringBox, height: ringBox, borderRadius: ringBox / 2, borderWidth: 1.2, borderColor: MINT } as const;
  return (
    <View pointerEvents="none" style={styles.center}>
      {enabled ? (
        <>
          <Animated.View style={[ring, first]} />
          <Animated.View style={[ring, second]} />
        </>
      ) : null}
      <View testID="you-are-here" style={[styles.you, { width: dot, height: dot, borderRadius: dot / 2 }]} />
    </View>
  );
}

function FloatingChip({ spec, size, still }: { spec: ChipSpec; size: number; still: boolean }) {
  const enter = useRef(new Animated.Value(still ? 1 : 0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) return;
    Animated.spring(enter, { toValue: 1, delay: spec.delay, useNativeDriver: true, speed: 12, bounciness: 10 }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: spec.period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: spec.period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [still, enter, drift, spec.delay, spec.period]);

  const y = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.022] });
  // Наклейки не должны давить маленький арт (320 px по ширине): ниже 260 px сжимаем их, но не мельче 0,72.
  const fit = Math.min(1, Math.max(0.72, size / 260));
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.4 * fit, fit] });
  const band = heatBand(spec.ratio);
  const anchor = band === "calm" ? MINT : STICKER_FILL[band];

  return (
    <Animated.View
      pointerEvents="none"
      // 0.5 ширины подгоняем под наклейку (~64 px): центрируем по заданной точке, не зная точной ширины.
      style={[styles.chip, { left: spec.x * size - 32, top: spec.y * size - 12, opacity: enter, transform: [{ translateY: y }, { scale }] }]}
    >
      <DiscountStamp percent={spec.percent} ratio={spec.ratio} tilt={spec.tilt} />
      {/* Якорь на карте: тонкая ножка и точка в цвет жара — наклейка не висит в воздухе, а «стоит» на месте предложения. */}
      <View style={styles.anchor}>
        <View style={[styles.stem, { backgroundColor: anchor }]} />
        <View style={[styles.anchorHalo, { borderColor: `${anchor}66` }]}>
          <View style={[styles.anchorDot, { backgroundColor: anchor }]} />
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * Арт приветственной страницы: только карта города в круге (река, кварталы, проспекты, подписи), метки предложений
 * точками на улицах, пунктирный круг с рисками по краю, точка «вы здесь» и три наклейки со скидкой на якорях — цвет
 * наклейки = жар окна, как на карточках внутри. Никаких абстрактных форм. Для скринридера не существует: смысл несёт заголовок.
 */
export function WelcomeArt({ size }: { size: number }) {
  const reduced = useReducedMotion();
  const uid = useUniqueId("welcomeArt");
  const spinBezel = useSpin(150_000, !reduced);

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // На web (RN-web) эти два флага не работают — нужен aria-hidden; на native он равнозначен им.
      aria-hidden
      pointerEvents="none"
    >
      {/* Статика: мягкое свечение в центре и риски сторон света. */}
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${uid}-glow`} cx="50" cy="50" r="48" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={MINT_DEEP} stopOpacity={0.3} />
            <Stop offset="0.55" stopColor={MINT_DEEP} stopOpacity={0.09} />
            <Stop offset="1" stopColor={MINT_DEEP} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${uid}-glow)`} />
        {TICKS.map((tick) => (
          <Line key={`${tick.x1}-${tick.y1}`} {...tick} stroke="#ffffff" strokeOpacity={0.4} strokeWidth={0.5} strokeLinecap="round" />
        ))}
      </Svg>

      {/* Город: река, кварталы, проспекты, подписи, метки предложений и маршрут от «вы здесь» к скидке. */}
      <WelcomeCityMap size={size} animate={!reduced} />

      {/* Пунктирный круг из точек по кромке — медленно поворачивается. */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spinBezel }] }]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="48.6" fill="none" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={0.6} strokeDasharray="0.4 2.7" strokeLinecap="round" />
        </Svg>
      </Animated.View>

      <YouAreHere size={size} enabled={!reduced} />
      {CHIPS.map((chip) => (
        <FloatingChip key={chip.percent} spec={chip} size={size} still={reduced} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  you: { backgroundColor: MINT, borderWidth: 2, borderColor: "#ffffff", boxShadow: "0 0 10px 2px rgba(94,234,212,0.7)" },
  chip: { position: "absolute" },
  anchor: { position: "absolute", top: "100%", left: 0, right: 0, alignItems: "center" },
  stem: { width: 1.2, height: 9, opacity: 0.85 },
  anchorHalo: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: -1 },
  anchorDot: { width: 5, height: 5, borderRadius: 2.5 },
});
