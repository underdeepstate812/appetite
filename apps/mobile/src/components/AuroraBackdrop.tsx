import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { contour } from "../utils/contour";
import { useUniqueId } from "../hooks/useUniqueId";

const TOPO = [
  ...[22, 44, 68, 94, 124, 158].map((r, i) => ({ d: contour(300, 34, r, 0.6), o: 0.13 - i * 0.015 })),
  ...[20, 42, 66, 92].map((r, i) => ({ d: contour(28, 214, r, 2.1), o: 0.1 - i * 0.015 })),
];

interface BlobSpec {
  color: string;
  size: number;
  left: number;
  top: number;
  opacity: number;
  driftX: number;
  driftY: number;
  period: number;
}

// Пятна держим у левого края (за фото) и внизу справа приглушённо: справа вверху лежит текст —
// под ним фон остаётся тёмным, чтобы белое и мятное держали ≥4.5:1.
const BLOBS: BlobSpec[] = [
  { color: "#2dd4bf", size: 230, left: -70, top: -60, opacity: 0.5, driftX: 22, driftY: 18, period: 9000 },
  { color: "#ff8a3d", size: 170, left: 170, top: 118, opacity: 0.26, driftX: -20, driftY: -14, period: 12000 },
  { color: "#5eead4", size: 140, left: 90, top: 70, opacity: 0.16, driftX: 16, driftY: 20, period: 15000 },
];

function Blob({ spec, still, uid }: { spec: BlobSpec; still: boolean; uid: string }) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: spec.period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: spec.period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [still, drift, spec.period]);

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [0, spec.driftX] });
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, spec.driftY] });
  const id = `${uid}-blob${spec.color.slice(1)}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", left: spec.left, top: spec.top, width: spec.size, height: spec.size, opacity: spec.opacity, transform: [{ translateX }, { translateY }] }}
    >
      <Svg width={spec.size} height={spec.size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={id} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={spec.color} stopOpacity={1} />
            <Stop offset="1" stopColor={spec.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Живой фон "полярного сияния": глубокий бирюзовый градиент, по которому медленно дрейфуют
 * три размытых пятна (мята, ember-оранжевый, светлая бирюза), а поверх — тонкие
 * изолинии карты. Дорого не выглядит и не стоит: только transform на native driver.
 * Родитель должен иметь overflow:hidden и скругление — фон рисуется абсолютно.
 */
export function AuroraBackdrop() {
  const reduced = useReducedMotion();
  const uid = useUniqueId("aurora");

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 360 240" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={`${uid}-base`} x1="0" y1="0" x2="360" y2="240" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#0c5a53" />
            <Stop offset="1" stopColor="#052e2b" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="360" height="240" fill={`url(#${uid}-base)`} />
      </Svg>
      {BLOBS.map((spec) => (
        <Blob key={spec.color} spec={spec} still={reduced} uid={uid} />
      ))}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 360 240" preserveAspectRatio="xMidYMid slice">
        {TOPO.map((line, index) => (
          <Path key={index} d={line.d} stroke="#ffffff" strokeOpacity={Math.max(line.o, 0.03)} strokeWidth={1.1} fill="none" />
        ))}
      </Svg>
    </View>
  );
}
