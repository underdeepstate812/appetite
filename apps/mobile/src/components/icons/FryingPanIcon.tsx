import React from "react";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";

interface FryingPanIconProps {
  size?: number;
  color: string;
  /** Цвет внутренней части сковороды (дно) — по умолчанию слегка темнее color. */
  panColor?: string;
}

/**
 * Сковорода вместо обычной "корзины" — фирменная иконка Apetite: и для статуса
 * "можно забирать" (OrderStatusTimeline), и для анимации оформления заказа
 * (CookingLoader) — один визуальный мотив на оба момента "твоя еда готовится/готова".
 */
export function FryingPanIcon({ size = 24, color, panColor }: FryingPanIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Ручка */}
      <Path
        d="M31 24 L45 20.5"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
      />
      {/* Дно сковороды */}
      <Circle cx={20} cy={26} r={15} fill={panColor ?? color} />
      {/* Борт сковороды — тонкое кольцо поверх дна для объёма */}
      <Circle cx={20} cy={26} r={15} stroke={color} strokeWidth={2.5} fill="none" />
      {/* Блик */}
      <Ellipse cx={15} cy={20} rx={5} ry={3} fill={color} opacity={0.35} />
    </Svg>
  );
}
