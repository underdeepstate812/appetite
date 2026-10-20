import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

export type DockIconName = "now" | "map" | "orders" | "eco" | "profile";

interface DockIconProps {
  name: DockIconName;
  size?: number;
  color: string;
  /** Цвет "искры" — единственной яркой точки иконки; загорается на активной вкладке. */
  dot: string;
  active: boolean;
}

/**
 * Пять вкладок — пять собственных знаков вместо эмодзи и стандартного набора иконок. У каждой ровно
 * одна "искра" (точка): на "Сейчас" — голова разомкнутой дуги, на "Карте" — метка на средней створке сложенной карты, на
 * "Заказах" — корешок билета, на "Эко" — кончик листа, на "Профиле" — слот пропуска. Активная —
 * лёгкая заливка (duotone) и искра с ореолом.
 */
export function DockIcon({ name, size = 24, color, dot, active }: DockIconProps) {
  const fill = active ? color : "none";
  const fillOpacity = active ? 0.18 : 0;
  const stroke = { stroke: color, strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  // Искра: сама точка + ореол на активной.
  const spark = (cx: number, cy: number, r: number) => (
    <>
      {active ? <Circle cx={cx} cy={cy} r={r + 3} fill={dot} fillOpacity={0.25} /> : null}
      <Circle cx={cx} cy={cy} r={r} fill={active ? dot : color} />
    </>
  );

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === "now" ? (
        <>
          <Circle cx={12} cy={12} r={8.5} fill={fill} fillOpacity={fillOpacity} stroke="none" />
          {active ? <Path d="M12 3.5 A8.5 8.5 0 1 1 7.75 4.64" {...stroke} /> : <Path d="M12 3.5 A8.5 8.5 0 1 1 3.5 12" {...stroke} />}
          {active ? spark(7.75, 4.64, 1.9) : spark(3.5, 12, 1.9)}
        </>
      ) : null}

      {name === "map" ? (
        <>
          {/* Простая сложенная карта: три створки и сгибы; метка — на средней. */}
          <Path d="M3.5 6.8 L9 4.8 L15 6.8 L20.5 4.8 V17.2 L15 19.2 L9 17.2 L3.5 19.2 Z" fill={fill} fillOpacity={fillOpacity} stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
          <Path d="M9 4.8 V17.2 M15 6.8 V19.2" {...stroke} strokeWidth={1.5} />
          {spark(12, 11.6, 1.7)}
        </>
      ) : null}

      {name === "orders" ? (
        <>
          <Path
            d="M7 6 H17 a3 3 0 0 1 3 3 v1.2 a1.8 1.8 0 0 0 0 3.6 V15 a3 3 0 0 1 -3 3 H7 a3 3 0 0 1 -3 -3 v-1.2 a1.8 1.8 0 0 0 0 -3.6 V9 a3 3 0 0 1 3 -3 Z"
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={color}
            strokeWidth={1.75}
            strokeLinejoin="round"
          />
          <Path d="M14.6 8.4 V15.6" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeDasharray="1.4 2.4" />
          {spark(17.4, 12, 1.5)}
        </>
      ) : null}

      {name === "eco" ? (
        <>
          <Path d="M5 19 C5 10.5 10 5 19 5 C19 14 13.5 19 5 19 Z" fill={fill} fillOpacity={fillOpacity} stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
          <Path d="M5 19 L12.5 11.5" {...stroke} strokeWidth={1.5} />
          {spark(18.4, 5.6, 1.7)}
        </>
      ) : null}

      {name === "profile" ? (
        <>
          <Path d="M7.5 5 H16.5 A3.5 3.5 0 0 1 20 8.5 V15.5 A3.5 3.5 0 0 1 16.5 19 H7.5 A3.5 3.5 0 0 1 4 15.5 V8.5 A3.5 3.5 0 0 1 7.5 5 Z" fill={fill} fillOpacity={fillOpacity} stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
          <Circle cx={9.4} cy={10.3} r={2.2} {...stroke} strokeWidth={1.5} />
          <Path d="M6.2 16.2 C6.6 14.6 7.9 13.9 9.4 13.9 C10.9 13.9 12.2 14.6 12.6 16.2" {...stroke} strokeWidth={1.5} />
          <Path d="M15 9.4 H17.2" {...stroke} strokeWidth={1.5} />
          {spark(16.1, 13.4, 1.4)}
        </>
      ) : null}
    </Svg>
  );
}
