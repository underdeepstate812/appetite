import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import { useTheme } from "../theme/ThemeProvider";
import { signatureRadius } from "../theme/tokens";
import { useUniqueId } from "../hooks/useUniqueId";
import { playHaptic } from "../utils/haptics";
import { useReducedMotion } from "../hooks/useReducedMotion";

/** Пульсация-«сердцебиение»: от кнопки расходится мягкое кольцо, затем пауза. Только для главных действий на спокойных экранах. */
export interface ButtonPulse {
  /** Цвет кольца; по умолчанию — цвет заливки кнопки. */
  color?: string;
  /** На сколько px кольцо выходит за край кнопки к концу вдоха. */
  spread?: number;
  /** Сдвиг старта, мс: две кнопки рядом пульсируют по очереди, а не хором. */
  delay?: number;
  /** Прозрачность кольца в начале (0–1). */
  strength?: number;
}

/** Кольцо — тонкий контур плюс лёгкая заливка (≈19%), а не сплошной «щит»: читается как сонар, а не как коробка за кнопкой. */
const softFill = (color: string) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}30` : "transparent");

const PULSE_MS = 1500;
const PULSE_REST_MS = 900;
/** Период одного «удара»: удобно для сдвига второй кнопки ровно на полпериода. */
export const BUTTON_PULSE_PERIOD_MS = PULSE_MS + PULSE_REST_MS;

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dangerSoft";
  /** "success" — одиночное "успешно" (например, сохранение); "light" — короткий щелчок. Праздничные партитуры играют экраны, а не кнопка. */
  haptic?: "light" | "success" | "none";
  /** Стрелка-спутник справа: едет к тексту при нажатии (как .btn-arrow на сайте). Для кнопок «дальше». */
  arrow?: boolean;
  /** "sm" — как .btn-sm на сайте (44 px, мельче шрифт): для действий внутри карточек. */
  size?: "md" | "sm";
  /** Мягкая пульсация кольца вокруг кнопки. Гаснет при нажатии, загрузке, disabled и при «уменьшении движения» в системе. */
  pulse?: boolean | ButtonPulse;
  /** Развёрнутая подпись для скринридера, когда одного заголовка мало («Маршрут» → «Маршрут до Shava Point»). */
  accessibilityLabel?: string;
}

/**
 * Кнопка — один в один как на сайте: плоская заливка бренд-цветом, мягкий глянец по верхней кромке
 * (белый 22% → 0 на 60% высоты), цветная тень, фирменный контур «4/18/4/18» и подпись системным шрифтом
 * весом 600. Вторичная — белая поверхность с рамкой 1.5 px; «призрак» — без фона. При нажатии кнопка
 * проседает (scale .98, сдвиг вниз) с лёгким haptic, стрелка подаётся к тексту. Загрузка — бегущий по нижней
 * кромке «фитиль» вместо крутилки.
 */
export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  haptic = "light",
  arrow = false,
  size = "md",
  pulse,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const dark = theme.mode === "dark";
  const glossId = useUniqueId("btnGloss");
  const isDisabled = disabled || loading;
  const solid = variant === "primary" || variant === "danger";

  const fill = variant === "danger" ? theme.colors.danger : theme.colors.primary;
  const ink = variant === "danger" ? (dark ? "#2a0a07" : "#ffffff") : theme.colors.onPrimary;
  const textColor = solid
    ? ink
    : variant === "dangerSoft"
      ? theme.colors.danger
      : variant === "ghost"
        ? theme.colors.textMuted
        : theme.colors.text;

  const pressAnim = useRef(new Animated.Value(0)).current;
  const animateTo = (toValue: number) =>
    Animated.spring(pressAnim, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  const handlePress = () => {
    if (isDisabled) return;
    if (haptic === "success") playHaptic("success");
    else if (haptic === "light") playHaptic("tap");
    onPress();
  };

  // Загрузка: короткий фитиль бежит по нижней кромке кнопки.
  const run = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading) return;
    const loop = Animated.loop(Animated.timing(run, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => {
      loop.stop();
      run.setValue(0);
    };
  }, [loading, run]);
  const runX = run.interpolate({ inputRange: [0, 1], outputRange: [-60, 260] });

  // Пульсация: кольцо той же формы (4/18/4/18) растёт от размеров кнопки на spread px и тает. Размеры нужны,
  // чтобы масштаб по осям давал одинаковый выступ в px (иначе у широкой кнопки кольцо вышло бы тонким сверху и толстым сбоку).
  const reduced = useReducedMotion();
  const pulseOptions: ButtonPulse | null = pulse ? (pulse === true ? {} : pulse) : null;
  const pulsing = !!pulseOptions && !isDisabled && !reduced;
  const pulseColor = pulseOptions?.color ?? fill;
  const pulseSpread = pulseOptions?.spread ?? 10;
  const pulseStrength = pulseOptions?.strength ?? 0.4;
  const pulseDelay = pulseOptions?.delay ?? 0;
  const beat = useRef(new Animated.Value(0)).current;
  const [box, setBox] = useState({ width: 280, height: 52 });
  useEffect(() => {
    if (!pulsing) return;
    beat.setValue(0);
    // Сдвиг — один раз перед циклом (а не внутри него): иначе период у кнопок разный и «по очереди» быстро превращается в «как попало».
    const loop = Animated.sequence([
      Animated.delay(pulseDelay),
      Animated.loop(
        Animated.sequence([
          Animated.timing(beat, { toValue: 1, duration: PULSE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.delay(PULSE_REST_MS),
          Animated.timing(beat, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ]);
    loop.start();
    return () => loop.stop();
  }, [pulsing, beat, pulseDelay]);
  const beatScaleX = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + (pulseSpread * 2) / box.width] });
  const beatScaleY = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + (pulseSpread * 2) / box.height] });
  // Пик — почти сразу, затем спад в два такта: кольцо успевает отойти от края, пока ещё заметно (а не растворяется впритык к кнопке).
  const beatOpacity = beat.interpolate({ inputRange: [0, 0.06, 0.45, 1], outputRange: [0, pulseStrength, pulseStrength * 0.5, 0] });

  const scale = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] });
  const translateY = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1.5] });
  const arrowX = pressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });

  const surface = solid
    ? { backgroundColor: fill, boxShadow: `0 10px 28px ${fill}${dark ? "40" : "38"}` }
    : variant === "dangerSoft"
      ? { backgroundColor: theme.colors.dangerSoft }
      : variant === "ghost"
        ? { backgroundColor: "transparent" }
        : {
            backgroundColor: theme.colors.surfaceElevated,
            borderWidth: 1.5,
            borderColor: theme.colors.border,
            boxShadow: dark ? "0 2px 10px rgba(0,0,0,0.35)" : "0 2px 10px rgba(18,16,13,0.05)",
          };

  return (
    <Animated.View style={{ transform: [{ scale }, { translateY }] }} onLayout={(event) => setBox({ width: event.nativeEvent.layout.width || 280, height: event.nativeEvent.layout.height || 52 })}>
      {pulsing ? (
        <Animated.View
          testID="button-pulse"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={[styles.pulse, signatureRadius, { borderColor: pulseColor, backgroundColor: softFill(pulseColor), opacity: beatOpacity, transform: [{ scaleX: beatScaleX }, { scaleY: beatScaleY }] }]}
        />
      ) : null}
      <Pressable
        onPress={handlePress}
        onPressIn={() => !isDisabled && animateTo(1)}
        onPressOut={() => animateTo(0)}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[styles.base, size === "sm" && styles.baseSm, signatureRadius, surface, { opacity: disabled ? 0.45 : loading ? 0.92 : 1, cursor: isDisabled ? "default" : "pointer" } as object]}
      >
        {solid ? (
          // Глянец: тот же вертикальный градиент, что .btn-primary::before на сайте.
          <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={dark ? 0.2 : 0.22} />
                <Stop offset="0.6" stopColor="#ffffff" stopOpacity={0} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${glossId})`} />
          </Svg>
        ) : null}
        <View style={styles.row}>
          <Text style={[styles.text, size === "sm" && styles.textSm, { color: textColor, opacity: loading ? 0.7 : 1 }]} numberOfLines={1}>
            {title}
          </Text>
          {arrow && !loading ? (
            <Animated.View style={{ transform: [{ translateX: arrowX }] }}>
              <ArrowRight size={17} color={textColor} strokeWidth={2.4} />
            </Animated.View>
          ) : null}
        </View>
        {loading ? (
          <View pointerEvents="none" style={styles.fuseClip}>
            <Animated.View style={[styles.fuse, { backgroundColor: textColor, transform: [{ translateX: runX }] }]} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, paddingHorizontal: 26, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  baseSm: { minHeight: 44, paddingHorizontal: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pulse: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2 },
  fuseClip: { position: "absolute", left: 26, right: 26, bottom: 7, height: 3, overflow: "hidden", borderRadius: 2 },
  fuse: { width: 60, height: 3, borderRadius: 2, opacity: 0.85 },
  text: { fontSize: 15, fontWeight: "600" },
  textSm: { fontSize: 14 },
});
