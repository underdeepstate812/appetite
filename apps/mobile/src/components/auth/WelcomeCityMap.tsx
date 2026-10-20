import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet } from "react-native";
import Svg, { Circle, Defs, G, Line, Mask, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";
import { buildCityMap, type PoiKind } from "../../utils/cityMap";
import { useUniqueId } from "../../hooks/useUniqueId";

const POI_COLOR: Record<PoiKind, string> = { mint: "#5eead4", ember: "#ff8a3d", amber: "#fbbf24" };

/** Подписи — системным гротеском: у SVG-текста на web по умолчанию засечки, а карте нужен «уличный» шрифт. */
const LABEL_FONT = Platform.OS === "web" ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" : undefined;

let cached: ReturnType<typeof buildCityMap> | null = null;
const city = () => (cached ??= buildCityMap());

/**
 * Карта города под изолиниями приветствия: река с каналами, парки, кварталы двух сеток, диагональные проспекты,
 * подписи (Нева, Невский, Фонтанка, Летний сад), метки предложений на улицах и пунктирный маршрут от знака к скидке.
 * Всё очень тихое по тону (контраст набирается только у знака, наклеек и маршрута) и гаснет к краям «линзы» —
 * поэтому карта добавляет глубину и детали, но не спорит с главным. Рисуется один раз, анимация — только мерцание меток.
 */
export function WelcomeCityMap({ size, animate }: { size: number; animate: boolean }) {
  const uid = useUniqueId("welcomeCity");
  const map = useMemo(city, []);
  const twinkle = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 0.25, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate, twinkle]);

  return (
    <>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${uid}-fade`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#ffffff" />
            <Stop offset="0.62" stopColor="#ffffff" />
            <Stop offset="1" stopColor="#000000" />
          </RadialGradient>
          <Mask id={`${uid}-lens`} x="0" y="0" width="100" height="100" maskUnits="userSpaceOnUse">
            <Rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-fade)`} />
          </Mask>
        </Defs>
        <G mask={`url(#${uid}-lens)`}>
          {/* Вода: река, блик по стрежню, каналы. */}
          <Path d={map.river.d} fill="none" stroke="#1b7a88" strokeOpacity={0.4} strokeWidth={map.river.width} strokeLinecap="round" />
          <Path d={map.river.d} fill="none" stroke="#7fe3ea" strokeOpacity={0.14} strokeWidth={1.6} strokeLinecap="round" />
          {map.canals.map((d) => (
            <Path key={d} d={d} fill="none" stroke="#1b7a88" strokeOpacity={0.36} strokeWidth={1.3} strokeLinecap="round" />
          ))}
          {/* Парки. */}
          {map.parks.map((park) => (
            <Path key={`${park.cx}-${park.cy}`} d={park.d} fill="#3fae82" fillOpacity={0.2} stroke="#3fae82" strokeOpacity={0.2} strokeWidth={1.4} strokeLinejoin="round" />
          ))}
          {/* Кварталы: три уровня заметности. */}
          <Path d={map.blocks.faint} fill="#ffffff" fillOpacity={0.045} />
          <Path d={map.blocks.mid} fill="#ffffff" fillOpacity={0.09} />
          <Path d={map.blocks.strong} fill="#9ff3e6" fillOpacity={0.17} />
          {/* Проспекты и кольцевая. */}
          {map.avenues.map((a) => (
            <Line key={`${a.x1}-${a.y1}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#ffffff" strokeOpacity={a.opacity} strokeWidth={a.width} strokeLinecap="round" />
          ))}
          <Circle cx="50" cy="50" r="31" fill="none" stroke="#ffffff" strokeOpacity={0.07} strokeWidth={0.4} strokeDasharray="1.2 1.8" />
          {/* Подписи: тихие, как на настоящей карте. */}
          {map.labels.map((label) => (
            <SvgText
              key={label.text}
              x={label.x}
              y={label.y}
              fill="#ffffff"
              fillOpacity={0.36}
              fontSize={label.size}
              fontFamily={LABEL_FONT}
              fontWeight="700"
              letterSpacing={label.spacing}
              textAnchor="middle"
              transform={`rotate(${label.angle} ${label.x} ${label.y})`}
            >
              {label.text}
            </SvgText>
          ))}
          {/* Маршрут от знака к скидке: пунктир ember и точка назначения. */}
          <Path d={map.route.d} fill="none" stroke="#ff8a3d" strokeOpacity={0.85} strokeWidth={0.95} strokeDasharray="1.7 1.4" strokeLinecap="round" strokeLinejoin="round" />
          {/* Метки предложений на улицах (ядро; мерцает только ореол ниже). */}
          {map.pois.map((poi) => (
            <Circle key={`${poi.x}-${poi.y}`} cx={poi.x} cy={poi.y} r={0.95} fill={POI_COLOR[poi.kind]} fillOpacity={0.95} />
          ))}
        </G>
      </Svg>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: twinkle }]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <G>
            {map.pois.map((poi) => (
              <Circle key={`${poi.x}-${poi.y}`} cx={poi.x} cy={poi.y} r={2.5} fill="none" stroke={POI_COLOR[poi.kind]} strokeOpacity={0.38} strokeWidth={0.4} />
            ))}
          </G>
        </Svg>
      </Animated.View>
    </>
  );
}
