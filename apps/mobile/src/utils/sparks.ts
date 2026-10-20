/**
 * Физика искр: веер вверх (−90° ± 70°), начальная скорость 140–300 px/с, сопротивление
 * k = 2.2/с и плавучесть 120 px/с² вверх — искры не падают, как конфетти, а поднимаются и гаснут.
 * Считаем ключевые кадры один раз при монтировании, а анимируем одним мастер-значением.
 */
export const SPARK_LIFE_MS = 1300;
export const SPARK_KEYS = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1] as const;

const DRAG = 2.2;
const BUOYANCY = 120;

export interface SparkSpec {
  x: number[];
  y: number[];
  opacity: number[];
  angleDeg: number;
  length: number;
  thickness: number;
  colorIndex: number;
  scaleEnd: number;
}

function seeded(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Доли палитры: 40% / 30% / 20% / 10% — детерминированно по индексу искры. */
function pickColorIndex(n: number, count: number): number {
  const share = (n + 0.5) / count;
  if (share < 0.4) return 0;
  if (share < 0.7) return 1;
  if (share < 0.9) return 2;
  return 3;
}

export function buildSparks(count: number, seedOffset = 0): SparkSpec[] {
  return Array.from({ length: count }, (_, n) => {
    const r = (k: number) => seeded(n * 7 + k + seedOffset);
    const theta = (-90 + (r(1) - 0.5) * 140) * (Math.PI / 180);
    const speed = 140 + r(2) * 160;
    const vx = Math.cos(theta) * speed;
    const vy = Math.sin(theta) * speed;
    const phase = r(3);
    const life = (900 + r(4) * 400) / SPARK_LIFE_MS;
    const streak = r(5) < 0.3;

    const x: number[] = [];
    const y: number[] = [];
    const opacity: number[] = [];
    for (const key of SPARK_KEYS) {
      const t = key * (SPARK_LIFE_MS / 1000);
      const decay = 1 - Math.exp(-DRAG * t);
      const sway = 6 * Math.sin(2 * Math.PI * (1.4 * t + phase));
      x.push((vx / DRAG) * decay + sway);
      y.push((vy / DRAG) * decay - 0.5 * BUOYANCY * t * t);
      opacity.push(key === 0 ? 0 : key <= 0.1 ? 1 : key <= life * 0.6 ? 1 : key >= life ? 0 : 1 - (key - life * 0.6) / (life * 0.4));
    }

    return {
      x,
      y,
      opacity,
      angleDeg: (Math.atan2(vy, vx) * 180) / Math.PI,
      length: streak ? 8 : 3 + r(6) * 2,
      thickness: streak ? 2 : 3 + r(6) * 2,
      colorIndex: pickColorIndex(n, count),
      scaleEnd: 0.4,
    };
  });
}

export const SPARK_COLORS = {
  dark: ["#b8fbef", "#2dd4bf", "#fbbf24", "#ff8a3d"],
  light: ["#0f766e", "#14b8a6", "#f59e0b", "#ea580c"],
} as const;
