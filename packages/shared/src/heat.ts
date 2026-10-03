/**
 * Шкала "жара" (Ember) принадлежит ТОЛЬКО оставшемуся времени: 0 — спокойно (бирюза), затем
 * янтарь, ember-оранжевый и красный лишь в последние ~30 минут окна. Единый источник для
 * mobile (theme/heat.ts) и web (маркеры на карте, лендинг) — раньше палитра дублировалась.
 */
export type ThemeMode = "light" | "dark";
type Band = "calm" | "warm" | "hot" | "crit";

const FILL: Record<ThemeMode, Record<Band, string>> = {
  dark: { calm: "#2dd4bf", warm: "#fbbf24", hot: "#ff8a3d", crit: "#ff5c4d" },
  light: { calm: "#0f766e", warm: "#b87400", hot: "#c93f08", crit: "#d92d20" },
};

const STOP_POSITIONS = [0, 0.27, 0.42, 0.52, 0.62, 0.78, 0.9, 1] as const;
const STOP_BANDS: readonly Band[] = ["calm", "calm", "warm", "warm", "hot", "hot", "crit", "crit"];

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

/** Линейное смешение двух hex-цветов: 0 — a, 1 — b. */
export function mixColors(a: string, b: string, amount: number): string {
  const t = Math.min(1, Math.max(0, amount));
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

/** Дискретная полоса жара — для текста и меток (пороги 0.33 / 0.55 / 0.83 ≈ 120 / 81 / 31 мин). */
export function heatBand(ratio: number): Band {
  if (ratio >= 0.83) return "crit";
  if (ratio >= 0.55) return "hot";
  if (ratio >= 0.33) return "warm";
  return "calm";
}

/** Непрерывный цвет шкалы для ratio 0..1 (за пределами зажимается) — для линий, маркеров, свечения. */
export function heatColor(ratio: number, mode: ThemeMode): string {
  const value = Math.min(1, Math.max(0, ratio));
  const palette = FILL[mode];
  for (let i = 1; i < STOP_POSITIONS.length; i += 1) {
    if (value <= STOP_POSITIONS[i]) {
      const span = STOP_POSITIONS[i] - STOP_POSITIONS[i - 1];
      return mixColors(palette[STOP_BANDS[i - 1]], palette[STOP_BANDS[i]], span === 0 ? 1 : (value - STOP_POSITIONS[i - 1]) / span);
    }
  }
  return palette[STOP_BANDS[STOP_BANDS.length - 1]];
}

/**
 * Цвет ТЕКСТА для жара: тот же оттенок, но подмешано 30% основного цвета текста — так держится
 * ≥5:1 на любой поверхности при любом ratio (голый heatColor на бумаге даёт 3.8–4.4:1).
 * Ярким остаётся только графика: линия, голова, свечение.
 */
export function heatInk(ratio: number, mode: ThemeMode, textColor: string): string {
  return mixColors(heatColor(ratio, mode), textColor, 0.3);
}

/** Мягкая подложка под цвет шкалы: тот же оттенок, растворённый в фоне. */
export function heatTint(ratio: number, mode: ThemeMode, background: string): string {
  return mixColors(background, heatColor(ratio, mode), mode === "dark" ? 0.2 : 0.14);
}

/** Опорные точки шкалы для градиентов (SVG <Stop>): позиция 0..1 и цвет. */
export function heatStops(mode: ThemeMode): readonly [number, string][] {
  return STOP_POSITIONS.map((position, index) => [position, FILL[mode][STOP_BANDS[index]]] as [number, string]);
}
