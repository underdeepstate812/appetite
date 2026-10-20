import { useMemo } from "react";
import QRCode from "qrcode";

interface AppQrProps {
  /** Что кодирует QR. */
  value: string;
  /** Сторона всей плитки (с белыми полями), px. */
  size?: number;
  label: string;
}

const QUIET_ZONE = 2; // модулей белой рамки вокруг кода — меньше сканеры читают плохо

/**
 * QR рисуется своим SVG из матрицы модулей (а не картинкой/innerHTML): векторный, чёткий на любой плотности
 * пикселей и без внешних запросов. Плитка всегда светлая — на тёмном футере инвертированный QR многие
 * камеры не распознают.
 */
export function AppQr({ value, size = 76, label }: AppQrProps) {
  const { path, count } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    let d = "";
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (qr.modules.get(row, col)) d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
    return { path: d, count: n };
  }, [value]);

  const box = count + QUIET_ZONE * 2;
  return (
    <svg
      className="app-qr"
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={box} height={box} rx="1.4" fill="#fffdf9" />
      <path d={path} fill="#12100d" />
    </svg>
  );
}
