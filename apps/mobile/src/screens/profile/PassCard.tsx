import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";
import { HeroArt } from "../../components/HeroArt";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useUniqueId } from "../../hooks/useUniqueId";

/** Цвета "печатной" части: одинаковы в обеих темах — это предмет, а не фон интерфейса. */
export const PASS_INK = "#FFFFFF";
export const PASS_INK_SOFT = "rgba(255,255,255,0.82)";
export const PASS_MINT = "#99F6E4";

const CARD_RADIUS = 26;
const INSET = 7;
/** Радиус выреза-«проколки» по бокам линии отрыва и отступ линии от героя. */
const NOTCH = 11;
const PERF_GAP = 12;

/**
 * Профиль как билет-пропуск: лицо (герой на «светящемся» фоне) и корешок с данными разделены линией отрыва — пунктир с
 * двумя вырезами по краям, как у билета заказа (тот же язык, что PickupTicket). Рамка с отступом 7 px даёт «карту в
 * кармашке». По лицу один раз проходит блик — как по голографической наклейке (при «уменьшить движение» его нет).
 * Внизу корешка — необязательная подвязка (номер пропуска и штрих-код).
 */
export function PassCard({ hero, stub, footer }: { hero: React.ReactNode; stub: React.ReactNode; footer?: React.ReactNode }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const uid = useUniqueId("passSheen");
  const [heroBox, setHeroBox] = useState({ width: 0, height: 0 });
  const sheen = useRef(new Animated.Value(0)).current;
  const shadow = theme.mode === "dark" ? "0 18px 36px rgba(0,0,0,0.55)" : "0 18px 36px rgba(15,118,110,0.14)";

  useEffect(() => {
    if (reduced || heroBox.width === 0) return;
    sheen.setValue(0);
    Animated.timing(sheen, { toValue: 1, duration: 1100, delay: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
  }, [reduced, heroBox.width, sheen]);

  const onHeroLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setHeroBox((current) => (Math.round(current.width) === Math.round(width) && Math.round(current.height) === Math.round(height) ? current : { width: Math.round(width), height: Math.round(height) }));
  };
  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-140, heroBox.width + 60] });
  const perfY = INSET + heroBox.height + PERF_GAP;

  return (
    // Тень — на внешней обёртке: overflow:hidden на внутренней иначе срезает её на iOS.
    <View style={{ borderRadius: CARD_RADIUS, boxShadow: shadow }}>
      <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
        <View style={styles.hero} onLayout={onHeroLayout}>
          <HeroArt variant="quiet" />
          <View style={styles.heroContent}>{hero}</View>
          {!reduced && heroBox.width > 0 ? (
            <Animated.View pointerEvents="none" style={[styles.sheen, { transform: [{ translateX: sheenX }, { rotate: "16deg" }] }]}>
              <Svg width={90} height={heroBox.height + 120}>
                <Defs>
                  <LinearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
                    <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0.2} />
                    <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect width={90} height={heroBox.height + 120} fill={`url(#${uid}-g)`} />
              </Svg>
            </Animated.View>
          ) : null}
        </View>

        {/* Линия отрыва: пунктир и два выреза под цвет страницы — «билет» держится за корешок. */}
        {heroBox.height > 0 ? (
          <>
            <View pointerEvents="none" style={[styles.perf, { top: perfY, borderTopColor: `${theme.colors.textMuted}66` }]} />
            <View pointerEvents="none" style={[styles.notch, { top: perfY - NOTCH, left: -NOTCH, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]} />
            <View pointerEvents="none" style={[styles.notch, { top: perfY - NOTCH, right: -NOTCH, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]} />
          </>
        ) : null}

        <View style={styles.stub}>{stub}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CARD_RADIUS, borderWidth: 1, padding: INSET, overflow: "hidden" },
  hero: { borderRadius: CARD_RADIUS - INSET, overflow: "hidden" },
  heroContent: { padding: 18, paddingBottom: 22 },
  sheen: { position: "absolute", top: -60, left: 0 },
  perf: { position: "absolute", left: NOTCH + 6, right: NOTCH + 6, height: 0, borderTopWidth: 1.5, borderStyle: "dashed" },
  notch: { position: "absolute", width: NOTCH * 2, height: NOTCH * 2, borderRadius: NOTCH, borderWidth: 1 },
  stub: { paddingHorizontal: 14, paddingTop: PERF_GAP + 20, paddingBottom: 10 },
  footer: { paddingHorizontal: 14, paddingBottom: 10 },
});
