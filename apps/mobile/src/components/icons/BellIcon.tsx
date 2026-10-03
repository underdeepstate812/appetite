import React from "react";
import Svg, { Path } from "react-native-svg";

interface LayerProps {
  size: number;
  color: string;
}

/** Точка подвеса колокольчика в координатах viewBox 24 — вокруг неё качается весь корпус. */
export const BELL_PIVOT_Y = 4.4;

const BODY =
  "M12 4.4 C8.6 4.4 6.4 7 6.4 10.4 V14 C6.4 15.4 5.6 16.4 4.6 17.2 C4.15 17.6 4.35 18.4 5 18.4 H19 C19.65 18.4 19.85 17.6 19.4 17.2 C18.4 16.4 17.6 15.4 17.6 14 V10.4 C17.6 7 15.4 4.4 12 4.4 Z";

/**
 * Колокольчик собран из независимых слоёв, чтобы каждый двигался по-своему: корпус (качается на
 * подвесе), язычок (запаздывает и бьёт в противофазе) и волны звука. Классический узнаваемый
 * силуэт — купол, расширяющийся кант, плоский "узелок". Спокойно: тонкий контур. Непрочитанное:
 * контур и лёгкая заливка цветом акцента (α .18) — без градиентов и плашки.
 */
export function BellBody({ size, color, active }: LayerProps & { active: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10 2.6 H14" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <Path
        d={BODY}
        fill={active ? color : "none"}
        fillOpacity={active ? 0.18 : 0}
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BellClapper({ size, color }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9.6 19.7 A2.4 2.4 0 0 0 14.4 19.7 Z" fill={color} />
    </Svg>
  );
}

/** Две дуги "звука" по бокам: появляются один раз, когда прилетает новое уведомление. */
export function BellWaves({ size, color }: LayerProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.2 8.2 C2.3 9.6 2.1 11.2 2.4 12.8" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M20.8 8.2 C21.7 9.6 21.9 11.2 21.6 12.8" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
