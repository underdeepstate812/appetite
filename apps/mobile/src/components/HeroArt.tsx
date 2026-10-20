import React, { useState } from "react";
import { Image, StyleSheet, View, type LayoutChangeEvent } from "react-native";

// Минималистичная картинка бренда: изумрудный зернистый градиент, тёплое «солнце» со срезами и тонкие кольца-изолинии.
// Нарисована процедурно (SVG → JPEG, ~60 КБ), поэтому не требует сети и не тянет тяжёлых ассетов.
const ART = require("../../assets/images/hero-ember.jpg");
// Спокойный вариант без «солнца» — для героев, где поверх лежит длинный текст (пропуск профиля): текст всегда читается.
const ART_QUIET = require("../../assets/images/hero-ember-quiet.jpg");
const BASE = "#052e2b";
/** Пропорции картинки (портрет 2:3). */
const RATIO = 1.5;

/**
 * Фон героя: картинка прижата к верху и растянута по ширине контейнера, а контейнер обрезает её снизу —
 * «солнце» всегда остаётся в верхнем правом углу, а нижняя, самая тёмная часть даёт контраст тексту.
 * Размеры заданы явно по измеренной ширине: React Native Web игнорирует aspectRatio у Image, и картинка
 * иначе растягивалась бы по высоте контейнера. Родитель должен иметь overflow:hidden; для скринридеров — декор.
 */
export function HeroArt({ variant = "sun" }: { variant?: "sun" | "quiet" }) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { backgroundColor: BASE }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 ? <Image source={variant === "quiet" ? ART_QUIET : ART} resizeMode="stretch" style={[styles.image, { width, height: Math.round(width * RATIO) }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { position: "absolute", top: 0, left: 0 },
});
