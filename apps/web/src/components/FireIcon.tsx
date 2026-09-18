import type { CSSProperties } from "react";

/**
 * Лёгкая CSS-анимация пламени вместо статичной SVG-иконки: три слоя тёплого
 * градиента ("языка"), каждый со своим циклом flicker (масштаб/поворот,
 * без анимации layout — только transform/opacity) и своей задержкой — эта
 * рассинхронность между слоями и читается глазом как живое мерцание, а не
 * как один объект, дышащий туда-сюда синхронно.
 */
export function FireIcon({ size = 14 }: { size?: number }) {
  const style = { "--fire-size": `${size}px` } as CSSProperties;
  return (
    <span className="fire-icon" style={style} aria-hidden="true">
      <span className="fire-flame fire-flame-1" />
      <span className="fire-flame fire-flame-2" />
      <span className="fire-flame fire-flame-3" />
    </span>
  );
}
