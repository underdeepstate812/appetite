import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Line, Path, Stop } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { playHaptic } from "../utils/haptics";
import { SparkBurst } from "./SparkBurst";
import { useUniqueId } from "../hooks/useUniqueId";

const NOTCH = 26;
const FRAME = 244;
const TILE = 204;
const CORNER = 30;
const PIN_GROUP = 3;

/** Уголки видоискателя: рамка "наведи сканер сюда" вокруг белой плитки с QR. */
function ViewfinderCorners({ color }: { color: string }) {
  const e = FRAME - 2;
  const paths = [
    `M2 ${CORNER} V12 Q2 2 12 2 H${CORNER}`,
    `M${e - CORNER + 2} 2 H${e - 10} Q${e + 2} 2 ${e + 2} 12 V${CORNER}`,
    `M${e + 2} ${e - CORNER + 2} V${e - 10} Q${e + 2} ${e + 2} ${e - 10} ${e + 2} H${e - CORNER + 2}`,
    `M${CORNER} ${e + 2} H12 Q2 ${e + 2} 2 ${e - 10} V${e - CORNER + 2}`,
  ];
  return (
    <Svg width={FRAME} height={FRAME} style={StyleSheet.absoluteFill}>
      {paths.map((d, index) => (
        <Path key={index} d={d} stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  );
}

function PinKeycap({ digit, index, animate, press }: { digit: string; index: number; animate: boolean; press: Animated.Value }) {
  const theme = useTheme();
  const dark = theme.mode === "dark";
  const rise = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.spring(rise, { toValue: 1, delay: 560 + index * 60, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  }, [animate, rise, index]);

  // Клавиша "вдавливается": волна по ряду при тапе, каждая клавиша чуть позже соседней.
  const dip = press.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });
  const translateY = Animated.add(rise.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }), dip);
  const opacity = rise.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View
      style={[
        styles.keycap,
        {
          backgroundColor: dark ? "#1e3a37" : "#ffffff",
          borderColor: theme.colors.border,
          // "Толщина" клавиши: нижний слэб и тонкий блик по верхней кромке.
          borderBottomWidth: 4,
          borderBottomColor: dark ? "#0a1918" : "#d8cdb4",
          boxShadow: `inset 0 1px 0 ${dark ? "rgba(255,255,255,0.10)" : "#ffffff"}`,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Text style={[theme.fonts.bold, styles.digit, { color: theme.colors.text }]}>{digit}</Text>
    </Animated.View>
  );
}

interface PickupTicketProps {
  qrCodeDataUrl: string;
  pickupCode: string;
  /** Заказ готов к выдаче — рамка сканера переключается с ember-подсветки "готовится" на бирюзовую "готово". */
  ready: boolean;
  codeLabel: string;
  footnote?: string;
  /** Проиграть появление "печати": билет выезжает, PIN переворачивается клавиша за клавишей. */
  entrance?: boolean;
}

/**
 * Билет выдачи: QR в рамке-видоискателе, линия отрыва с круглыми вырезами и PIN на
 * клавишах-"кейкапах". Порядок прежний (QR → код), но теперь это один предмет, который
 * "печатается" при появлении. Вокруг QR — тонкий блик, проходящий раз в несколько секунд:
 * он подчёркивает, что код живой, и держится на столько прозрачным, что не мешает сканеру.
 */
export function PickupTicket({ qrCodeDataUrl, pickupCode, ready, codeLabel, footnote, entrance = false }: PickupTicketProps) {
  const uid = useUniqueId("pickupTicket");
  const theme = useTheme();
  const reduced = useReducedMotion();
  const animate = entrance && !reduced;

  const enter = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const lock = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;

  const scan = () => {
    if (reduced) return;
    sweep.setValue(0);
    Animated.timing(sweep, { toValue: 1, duration: 640, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
  };

  // "Печать" билета: выезжает сверху, скобки видоискателя "захватывают" код, один раз проходит сканирующий блик.
  useEffect(() => {
    if (!animate) return;
    Animated.timing(enter, { toValue: 1, duration: 420, delay: 140, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
    Animated.timing(lock, { toValue: 1, duration: 320, delay: 380, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
    const timer = setTimeout(scan, 620);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  const tapRow = () => {
    playHaptic("tap");
    if (reduced) return;
    press.setValue(0);
    Animated.sequence([
      Animated.timing(press, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(press, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();
  };

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [-36, 0] });
  const sweepY = sweep.interpolate({ inputRange: [0, 1], outputRange: [-60, TILE] });
  const sweepOpacity = sweep.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.9, 0.9, 0] });
  const bracketScale = lock.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] });

  const bracket = theme.colors.primary;
  const groups: string[] = [];
  for (let i = 0; i < pickupCode.length; i += PIN_GROUP) groups.push(pickupCode.slice(i, i + PIN_GROUP));
  let keyIndex = 0;

  return (
    <Animated.View
      style={[
        styles.ticket,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderColor: theme.colors.border,
          opacity: enter,
          transform: [{ translateY }],
          boxShadow: theme.mode === "dark" ? "0 18px 36px rgba(0,0,0,0.5)" : "0 18px 36px rgba(15,118,110,0.13)",
        },
      ]}
    >
      <View style={styles.qrSection}>
        <Pressable
          onPress={() => {
            playHaptic("tap");
            scan();
          }}
          accessibilityRole="image"
          accessibilityLabel={codeLabel}
          style={{ width: FRAME, height: FRAME, alignItems: "center", justifyContent: "center" }}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: lock, transform: [{ scale: bracketScale }] }]}>
            <ViewfinderCorners color={bracket} />
          </Animated.View>
          <View style={styles.tile}>
            {/* Имя у QR даёт обёртка (role=image): у самой картинки повторная подпись на div без роли нарушает ARIA. */}
            <Image testID="pickup-qr" source={{ uri: qrCodeDataUrl }} style={styles.qr} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            <Animated.View pointerEvents="none" style={[styles.sweep, { opacity: sweepOpacity, transform: [{ translateY: sweepY }] }]}>
              <Svg width={TILE} height={60}>
                <Defs>
                  <LinearGradient id={`${uid}-qrSweep`} x1="0" y1="0" x2="0" y2="60" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor={bracket} stopOpacity={0} />
                    <Stop offset="0.5" stopColor="#5eead4" stopOpacity={0.5} />
                    <Stop offset="1" stopColor={bracket} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Path d={`M0 0 H${TILE} V60 H0 Z`} fill="url(#${uid}-qrSweep)" />
              </Svg>
            </Animated.View>
          </View>
          {animate ? (
            <View style={{ position: "absolute", left: FRAME / 2, top: FRAME / 2, width: 0, height: 0 }}>
              <SparkBurst count={28} delay={420} seed={5} />
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.perforation}>
        <Svg style={styles.dash} height={2} width="100%">
          <Line x1="0" y1="1" x2="100%" y2="1" stroke={theme.colors.textMuted} strokeOpacity={0.4} strokeWidth={2} strokeDasharray="5 7" strokeLinecap="round" />
        </Svg>
        <View style={[styles.notch, styles.notchLeft, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]} />
        <View style={[styles.notch, styles.notchRight, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]} />
      </View>

      <View style={styles.pinSection}>
        <Text style={[styles.codeLabel, { color: theme.colors.textMuted }]}>{codeLabel.toUpperCase()}</Text>
        <Pressable onPress={tapRow} style={styles.pinRow} accessible role="group" accessibilityLabel={`${codeLabel}: ${pickupCode.split("").join(" ")}`}>
          {groups.map((group, groupIndex) => (
            <React.Fragment key={groupIndex}>
              {groupIndex > 0 ? <View style={[styles.pinGap, { backgroundColor: theme.colors.border }]} /> : null}
              <View style={styles.pinGroup}>
                {group.split("").map((digit) => {
                  const node = <PinKeycap key={keyIndex} digit={digit} index={keyIndex} animate={animate} press={press} />;
                  keyIndex += 1;
                  return node;
                })}
              </View>
            </React.Fragment>
          ))}
        </Pressable>
        {footnote ? <Text style={[styles.footnote, { color: theme.colors.textMuted }]}>{footnote}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ticket: { borderRadius: 26, borderWidth: 1, overflow: "hidden", alignSelf: "stretch" },
  qrSection: { alignItems: "center", paddingTop: 24, paddingBottom: 22 },
  tile: { width: TILE, height: TILE, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  qr: { width: TILE - 20, height: TILE - 20 },
  sweep: { position: "absolute", top: 0, left: 0, width: TILE, height: 60 },
  perforation: { height: NOTCH, justifyContent: "center" },
  dash: { position: "absolute", left: NOTCH, right: NOTCH, top: NOTCH / 2 - 1 },
  notch: { position: "absolute", top: 0, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, borderWidth: 1 },
  notchLeft: { left: -NOTCH / 2 - 1 },
  notchRight: { right: -NOTCH / 2 - 1 },
  pinSection: { alignItems: "center", paddingTop: 18, paddingBottom: 22, paddingHorizontal: 16 },
  codeLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.4 },
  pinRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  pinGroup: { flexDirection: "row", gap: 6 },
  pinGap: { width: 8, height: 3, borderRadius: 2, marginHorizontal: 9 },
  keycap: { width: 42, height: 56, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  digit: { fontSize: 24, lineHeight: 30, fontVariant: ["tabular-nums"] },
  footnote: { fontSize: 13, marginTop: 14, textAlign: "center" },
});
