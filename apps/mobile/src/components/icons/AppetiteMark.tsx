import React from "react";
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from "react-native-svg";
import { useUniqueId } from "../../hooks/useUniqueId";

/**
 * Новый фирменный знак (замена эмодзи 🍊 + текстового логотипа) — "жидкая
 * капля-пин с укусом": силуэт картографического пина (карта — ядро продукта),
 * органические асимметричные кривые (жидкий металл, см. бриф про Fluid Map
 * Pins), и вырез-укус сбоку (Apetite = аппетит, откушенный кусок еды). Три
 * смысловых слоя в одном знаке вместо генерического апельсина.
 *
 * Вырезан как единый path с fillRule="evenodd" — укус остаётся прозрачным
 * "окном" на любом фоне (glass-хедер, тёмная/светлая тема), а не залит
 * захардкоженным цветом фона.
 */
export function AppetiteMark({ size = 32 }: { size?: number }) {
  const uid = useUniqueId("mark");
  const gradId = `${uid}-grad`;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Defs>
        <LinearGradient id={gradId} x1="8" y1="3" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#2DD4BF" />
          <Stop offset="100%" stopColor="#0F766E" />
        </LinearGradient>
      </Defs>
      <Path
        fillRule="evenodd"
        d="M24 3 C34 2 41 10 39 20 C38 27 33 33 26 40 C24.5 42 23 42 21 39 C14 31 8 25 9 17 C10 8 16 4 24 3 Z M39 13 A6 6 0 1 0 27 13 A6 6 0 1 0 39 13 Z"
        fill={`url(#${gradId})`}
      />
      <Circle cx="16" cy="14" r="2.5" fill="#FFFFFF" opacity={0.55} />
    </Svg>
  );
}
