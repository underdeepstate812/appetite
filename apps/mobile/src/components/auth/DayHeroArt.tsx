import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { heatColor } from "@apetite/shared";
import { useNow } from "../../hooks/useNow";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useUniqueId } from "../../hooks/useUniqueId";
import { dayPalette, hourOf } from "../../utils/dayPhase";
import { hashString } from "../../utils/contour";

interface DayHeroArtProps {
  /** Принудительный час 0…24 (для проверки и показа); по умолчанию — местное время, обновляется раз в минуту. */
  hour?: number;
  /** Жар показанного предложения 0…1 (доля окна самовывоза): красит гало диска и «планету» на орбите. null — нейтрально. */
  heat?: number | null;
}

const STAR_COUNT = 36;

/** Звёзды детерминированы (одно и то же небо при каждом показе): верхние 62% героя, у левого края их меньше — там текст. */
function makeStars(width: number, height: number) {
  const stars: { x: number; y: number; r: number; o: number; group: 0 | 1 }[] = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const a = hashString(`star-x-${i}`);
    const b = hashString(`star-y-${i}`);
    const c = hashString(`star-r-${i}`);
    stars.push({ x: width * (0.06 + 0.9 * a), y: height * 0.62 * b + 6, r: 0.8 + c * 1.3, o: 0.5 + 0.5 * hashString(`star-o-${i}`), group: i % 2 === 0 ? 0 : 1 });
  }
  return stars;
}

/** Бесконечное вращение на native driver; период в мс. */
function useSpin(periodMs: number, enabled: boolean) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: periodMs, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [enabled, periodMs, spin]);
  return spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
}

function useTwinkle(periodMs: number, enabled: boolean, phase = 0) {
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(phase),
        Animated.timing(value, { toValue: 0.35, duration: periodMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 1, duration: periodMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, periodMs, phase, value]);
  return value;
}

/**
 * Фон героя входа: «небо» меняется вместе с временем суток (рассвет → день → золотой час → закат → ночь со звёздами),
 * диск — солнце или луна, стоящие там, где они в этот час, тонкие кольца-орбиты вокруг. Цвет предложения (жар окна)
 * подмешан в гало диска, а по орбите ходит «планета» этого цвета: горящее предложение — тёплое небо, спокойное — мятное.
 * Всё нарисовано на лету (SVG), без картинок: час и предложение — просто параметры. Для скринридера — декор.
 */
export function DayHeroArt({ hour, heat = null }: DayHeroArtProps) {
  const reduced = useReducedMotion();
  const now = useNow(60000);
  const uid = useUniqueId("dayHero");
  const [box, setBox] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) => (Math.round(current.width) === Math.round(width) && Math.round(current.height) === Math.round(height) ? current : { width: Math.round(width), height: Math.round(height) }));
  };

  const h = hour ?? hourOf(now);
  const palette = useMemo(() => dayPalette(h), [h]);
  const { width, height } = box;
  const stars = useMemo(() => makeStars(width, height), [width, height]);

  const planetSpin = useSpin(46_000, !reduced);
  const twinkleA = useTwinkle(2600, !reduced && palette.stars > 0.05, 0);
  const twinkleB = useTwinkle(3300, !reduced && palette.stars > 0.05, 900);

  const heatTone = heat === null ? null : heatColor(heat, "dark");

  // Диск — меньше пятой части ширины и правее цифры скидки: «%» цвета ember не должен оказаться на оранжевом диске.
  // Высота — как у светила в этот час: у горизонта (рассвет/закат) диск у нижней кромки, в полдень — выше, но не под кнопкой «назад».
  const radius = Math.max(52, Math.min(150, Math.min(width * 0.17, height * 0.4)));
  const cx = Math.min(width * 0.88, width - radius * 0.45);
  const cy = height * (0.85 - 0.48 * palette.elevation);
  const rings = [radius * 1.5, radius * 2.1, radius * 2.9, radius * 3.9];
  const planetRing = rings[1];

  const dataSet = { dayPhase: palette.name, skyTop: palette.skyTop, hour: h.toFixed(2), heat: heat === null ? "none" : heat.toFixed(2) };

  return (
    <View
      testID="day-hero"
      pointerEvents="none"
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.skyBottom }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // На web флаги выше не работают — нужен aria-hidden; dataSet — для проверок (какое небо сейчас показано).
      {...({ "aria-hidden": true, dataSet } as object)}
    >
      {width > 0 ? (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={`${uid}-sky`} x1="0" y1="0" x2={width} y2={height} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={palette.skyTop} />
                <Stop offset="1" stopColor={palette.skyBottom} />
              </LinearGradient>
              <LinearGradient id={`${uid}-orb`} x1="0" y1={cy - radius} x2="0" y2={cy + radius} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={palette.orbTop} />
                <Stop offset="1" stopColor={palette.orbBottom} />
              </LinearGradient>
              <RadialGradient id={`${uid}-glow`} cx={cx} cy={cy} r={radius * 2.6} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={palette.glow} stopOpacity={palette.moon ? 0.34 : 0.6} />
                <Stop offset="0.45" stopColor={palette.glow} stopOpacity={palette.moon ? 0.12 : 0.22} />
                <Stop offset="1" stopColor={palette.glow} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id={`${uid}-heat`} cx={cx} cy={cy} r={radius * 1.7} gradientUnits="userSpaceOnUse">
                <Stop offset="0.55" stopColor={heatTone ?? palette.glow} stopOpacity={heatTone ? 0.5 : 0} />
                <Stop offset="1" stopColor={heatTone ?? palette.glow} stopOpacity={0} />
              </RadialGradient>
              <LinearGradient id={`${uid}-haze`} x1="0" y1={height * 0.45} x2="0" y2={height} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={palette.glow} stopOpacity={0} />
                <Stop offset="1" stopColor={palette.glow} stopOpacity={palette.moon ? 0.12 : 0.08 + 0.34 * (1 - palette.elevation)} />
              </LinearGradient>
              <LinearGradient id={`${uid}-scrim`} x1="0" y1={height * 0.4} x2="0" y2={height} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#000000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0.4} />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={height} fill={`url(#${uid}-sky)`} />
            {/* Дымка у горизонта: на рассвете и закате низ неба теплеет, в полдень почти незаметна. */}
            <Rect width={width} height={height} fill={`url(#${uid}-haze)`} />
            <Circle cx={cx} cy={cy} r={radius * 2.6} fill={`url(#${uid}-glow)`} />
            <Circle cx={cx} cy={cy} r={radius * 1.7} fill={`url(#${uid}-heat)`} />
            {/* Диск: у луны — кратеры (родня «глазу» знака), у солнца — гладкая заливка и тонкий светлый ободок. */}
            <Circle cx={cx} cy={cy} r={radius} fill={`url(#${uid}-orb)`} />
            <Circle cx={cx} cy={cy} r={radius} fill="none" stroke="#ffffff" strokeOpacity={palette.moon ? 0.18 : 0.28} strokeWidth={1} />
            {palette.moon ? (
              <>
                <Circle cx={cx + radius * 0.34} cy={cy - radius * 0.28} r={radius * 0.2} fill="#5d7488" fillOpacity={0.28} />
                <Circle cx={cx - radius * 0.28} cy={cy + radius * 0.1} r={radius * 0.12} fill="#5d7488" fillOpacity={0.22} />
                <Circle cx={cx + radius * 0.05} cy={cy + radius * 0.46} r={radius * 0.09} fill="#5d7488" fillOpacity={0.2} />
              </>
            ) : null}
            <Rect width={width} height={height} fill={`url(#${uid}-scrim)`} />
          </Svg>

          {/* Звёзды двумя группами — мерцают вразнобой. */}
          {palette.stars > 0.05 ? (
            <>
              {([0, 1] as const).map((group) => (
                <Animated.View key={group} style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(group === 0 ? twinkleA : twinkleB, palette.stars) }]}>
                  <Svg width={width} height={height}>
                    {stars
                      .filter((star) => star.group === group)
                      .map((star, i) => (
                        <Circle key={i} cx={star.x} cy={star.y} r={star.r} fill="#ffffff" fillOpacity={star.o} />
                      ))}
                  </Svg>
                </Animated.View>
              ))}
            </>
          ) : null}

          {/* Орбиты: тонкие кольца вокруг диска. */}
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            {rings.map((ring, i) => (
              <Circle key={ring} cx={cx} cy={cy} r={ring} fill="none" stroke={palette.ring} strokeOpacity={0.3 - i * 0.055} strokeWidth={1} />
            ))}
          </Svg>

          {/* «Планеты» на орбите: мятная и цвета показанного предложения. Вращаем квадрат с центром в центре диска. */}
          <Animated.View
            style={{ position: "absolute", left: cx - planetRing, top: cy - planetRing, width: planetRing * 2, height: planetRing * 2, transform: [{ rotate: planetSpin }] }}
          >
            <View style={[styles.planet, { top: -4, left: planetRing - 4, backgroundColor: "#8fe9d6", boxShadow: "0 0 8px 1px rgba(143,233,214,0.7)" }]} />
            <View
              style={[
                styles.planet,
                { top: planetRing - 5, left: planetRing * 2 - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: heatTone ?? "#8fe9d6", boxShadow: `0 0 12px 3px ${(heatTone ?? "#8fe9d6")}aa` },
              ]}
            />
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  planet: { position: "absolute", width: 8, height: 8, borderRadius: 4 },
});
