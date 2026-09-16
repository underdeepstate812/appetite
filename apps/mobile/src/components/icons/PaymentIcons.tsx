import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

interface PaymentIconProps {
  size?: number;
  color: string;
}

export function CardIcon({ size = 24, color }: PaymentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={5} width={20} height={14} rx={2.5} stroke={color} strokeWidth={1.8} />
      <Rect x={2} y={9} width={20} height={3.5} fill={color} />
      <Rect x={4.5} y={15} width={5} height={1.8} rx={0.9} fill={color} />
    </Svg>
  );
}

/** СБП — система быстрых платежей: стилизованная "молния" как знак мгновенного перевода. */
export function FastPaymentIcon({ size = 24, color }: PaymentIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2 L4.5 13.5 H11 L10 22 L19.5 10 H13 L13 2 Z"
        fill={color}
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
