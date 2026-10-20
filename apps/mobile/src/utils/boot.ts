/**
 * Сколько ещё держать заставку, когда приложение уже готово. Заставка не должна мелькать: если всё загрузилось за
 * 120 мс, человек успел бы увидеть лишь вспышку; поэтому показываем её минимум `minMs` от появления. Если готовность
 * пришла позже минимума — убираем сразу (0). Отрицательное/нечисловое время — как «только что появилась».
 */
export function remainingSplashMs(elapsedMs: number, minMs: number): number {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  return Math.max(0, minMs - elapsed);
}

/** Минимум показа: брендовый «вдох» длится 900 мс; при «уменьшить движение» заставка — лишь короткая вспышка знака. */
export const SPLASH_MIN_MS = 900;
export const SPLASH_MIN_MS_REDUCED = 250;
