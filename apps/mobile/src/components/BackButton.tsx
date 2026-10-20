import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { playHaptic } from "../utils/haptics";

/**
 * Кнопка "назад" для шапки стека: голая стрелка с длинным хвостом, без плашки в покое. Круг
 * появляется только под пальцем — мягкий цветной "бутон" расцветает от центра, голова стрелки
 * уезжает на 3px влево, хвост чуть вытягивается (пружина, как у остальных тактильных элементов).
 */
export function BackButton({ onPress, onDark = false }: { onPress: () => void; /** Поверх тёмного героя (вход/регистрация): светлая стрелка вместо цвета текста темы. */ onDark?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const press = useRef(new Animated.Value(0)).current;

  const to = (value: number, fast = false) =>
    Animated.spring(press, { toValue: value, useNativeDriver: true, speed: fast ? 50 : 30, bounciness: value ? 4 : 8 }).start();

  const ink = onDark ? "#ffffff" : theme.colors.text;
  const bloom = onDark ? "rgba(94,234,212,0.22)" : `${theme.colors.primary}24`;
  const bloomScale = press.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const nudge = press.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        playHaptic("tap");
        to(1, true);
      }}
      onPressOut={() => to(0)}
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      hitSlop={6}
      style={[styles.hit, { cursor: "pointer" }]}
    >
      {/* Поверх героя (там бывает светлое «солнце») стрелке нужна подложка в покое — иначе белое на золотом не читается. */}
      {onDark ? <View style={styles.rest} /> : null}
      <Animated.View style={[styles.bloom, { backgroundColor: bloom, opacity: press, transform: [{ scale: bloomScale }] }]} />
      <Animated.View style={{ transform: [{ translateX: nudge }] }}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M20 12H4.5" stroke={ink} strokeWidth={2} strokeLinecap="round" />
          <Path d="M10.5 6L4.5 12L10.5 18" stroke={ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 44px — минимальный touch-таргет; глиф 24px, кружок-бутон 40px рисуется только при нажатии.
  hit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  bloom: { position: "absolute", width: 40, height: 40, borderRadius: 20 },
  rest: { position: "absolute", width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(4,24,22,0.38)" },
});
