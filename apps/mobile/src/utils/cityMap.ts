import { hashString } from "./contour";

/**
 * Геометрия стилизованного «куска города» для арта приветствия (viewBox 100×100): река с рукавом и каналом, парки,
 * кварталы двух сеток по берегам, проспекты, метки предложений на улицах и маршрут от знака к одной из них.
 * Всё считается из фиксированных чисел — одна и та же карта при каждом показе, без картинок и без сети. Вид «как у
 * Санкт-Петербурга» (Нева, каналы, диагональные проспекты), но это именно рисунок, а не карта.
 */
export interface Point {
  x: number;
  y: number;
}

export type PoiKind = "mint" | "ember" | "amber";

export interface CityMap {
  /** Основная река: путь для обводки и ломаная для расчётов расстояния. */
  river: { d: string; points: Point[]; width: number };
  canals: string[];
  /** Парки: чёткие скруглённые прямоугольники по линиям улиц (не «кляксы») — читаются как сад или сквер. */
  parks: { d: string; cx: number; cy: number; r: number }[];
  /** Кварталы тремя уровнями заметности: подсказывают «плотность» города, не спорят со знаком. */
  blocks: { faint: string; mid: string; strong: string; count: number };
  avenues: { x1: number; y1: number; x2: number; y2: number; width: number; opacity: number }[];
  pois: { x: number; y: number; kind: PoiKind }[];
  route: { d: string; end: Point };
  labels: { text: string; x: number; y: number; angle: number; size: number; spacing: number }[];
}

/** Куда нельзя ставить кварталы и метки: вокруг точки «вы здесь» (центр арта) и под наклейками со скидкой. */
export const CENTER_CLEARING = 5;
const STAMP_SPOTS: Point[] = [
  { x: 20, y: 30 },
  { x: 80, y: 23 },
  { x: 80, y: 78 },
];
const LENS_RADIUS = 47;

const cubic = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};

const RIVER_SEGMENTS: [Point, Point, Point, Point][] = [
  [
    { x: -2, y: 66 },
    { x: 20, y: 52 },
    { x: 38, y: 72 },
    { x: 58, y: 57 },
  ],
  [
    { x: 58, y: 57 },
    { x: 78, y: 42 },
    { x: 88, y: 50 },
    { x: 102, y: 34 },
  ],
];
const RIVER_WIDTH = 6.4;

function sampleRiver(): Point[] {
  const points: Point[] = [];
  RIVER_SEGMENTS.forEach(([a, b, c, d], i) => {
    for (let s = i === 0 ? 0 : 1; s <= 40; s += 1) points.push(cubic(a, b, c, d, s / 40));
  });
  return points;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const rotate = (p: Point, deg: number, around: Point = { x: 50, y: 50 }): Point => {
  const r = (deg * Math.PI) / 180;
  const dx = p.x - around.x;
  const dy = p.y - around.y;
  return { x: around.x + dx * Math.cos(r) - dy * Math.sin(r), y: around.y + dx * Math.sin(r) + dy * Math.cos(r) };
};

/** Расстояние от точки до ломаной (по её плотной выборке — для рисунка этого достаточно). */
export function distanceToPolyline(p: Point, line: Point[]): number {
  let best = Infinity;
  for (const q of line) best = Math.min(best, dist(p, q));
  return best;
}

/** Высота реки в точке x (река идёт слева направо без петель): нужна, чтобы понять, на каком берегу квартал. */
function riverYAt(x: number, line: Point[]): number {
  let best = line[0];
  for (const q of line) if (Math.abs(q.x - x) < Math.abs(best.x - x)) best = q;
  return best.y;
}

function rectPath(center: Point, w: number, h: number, deg: number): string {
  const corners = [
    { x: center.x - w / 2, y: center.y - h / 2 },
    { x: center.x + w / 2, y: center.y - h / 2 },
    { x: center.x + w / 2, y: center.y + h / 2 },
    { x: center.x - w / 2, y: center.y + h / 2 },
  ].map((c) => rotate(c, deg, center));
  return `M${corners.map((c) => `${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" L")} Z`;
}

const PARK_SPECS = [
  { cx: 23, cy: 33, w: 13, h: 8.5, deg: 16 },
  { cx: 74, cy: 74, w: 14, h: 9.5, deg: -14 },
  { cx: 62, cy: 21, w: 9, h: 6.5, deg: 16 },
];
const PARKS = PARK_SPECS.map((park) => ({ d: rectPath({ x: park.cx, y: park.cy }, park.w, park.h, park.deg), cx: park.cx, cy: park.cy, r: Math.max(park.w, park.h) / 2 }));

export function buildCityMap(): CityMap {
  const riverPoints = sampleRiver();
  const river = {
    d: `M${RIVER_SEGMENTS[0][0].x} ${RIVER_SEGMENTS[0][0].y} ${RIVER_SEGMENTS.map(([, b, c, d]) => `C${b.x} ${b.y} ${c.x} ${c.y} ${d.x} ${d.y}`).join(" ")}`,
    points: riverPoints,
    width: RIVER_WIDTH,
  };
  const canals = ["M35 66 C29 49 33 30 44 6", "M69 50 C80 58 80 70 90 84"];
  const canalLines = [
    Array.from({ length: 30 }, (_, i) => cubic({ x: 35, y: 66 }, { x: 29, y: 49 }, { x: 33, y: 30 }, { x: 44, y: 6 }, i / 29)),
    Array.from({ length: 30 }, (_, i) => cubic({ x: 69, y: 50 }, { x: 80, y: 58 }, { x: 80, y: 70 }, { x: 90, y: 84 }, i / 29)),
  ];

  const blocked = (p: Point, pad = 0) =>
    dist(p, { x: 50, y: 50 }) < CENTER_CLEARING + pad ||
    dist(p, { x: 50, y: 50 }) > LENS_RADIUS ||
    distanceToPolyline(p, riverPoints) < RIVER_WIDTH / 2 + 2.2 + pad ||
    canalLines.some((line) => distanceToPolyline(p, line) < 2.6 + pad) ||
    PARKS.some((park) => dist(p, { x: park.cx, y: park.cy }) < park.r + 3 + pad) ||
    STAMP_SPOTS.some((spot) => dist(p, spot) < 10 + pad);

  const buckets = { faint: [] as string[], mid: [] as string[], strong: [] as string[] };
  const centers: { p: Point; bank: "A" | "B" }[] = [];
  // Берег A (северо-запад) — сетка, повёрнутая на +16°; берег B (юго-восток) — на −14°: как у настоящих районов разной эпохи.
  (
    [
      { bank: "A" as const, deg: 16, dx: 7.3, dy: 5.7, w: 6.1, h: 4.4 },
      { bank: "B" as const, deg: -14, dx: 7.6, dy: 5.9, w: 6.4, h: 4.6 },
    ] as const
  ).forEach(({ bank, deg, dx, dy, w, h }) => {
    for (let i = -11; i <= 11; i += 1) {
      for (let j = -11; j <= 11; j += 1) {
        const local = { x: 50 + i * dx, y: 50 + j * dy };
        const world = rotate(local, deg);
        const side = world.y < riverYAt(world.x, riverPoints) ? "A" : "B";
        if (side !== bank || blocked(world)) continue;
        const roll = hashString(`${bank}-${i}-${j}`);
        if (roll < 0.1) continue; // «пустыри» — рисунок не должен быть линейкой
        const path = rectPath(world, w * (0.86 + 0.14 * hashString(`w-${bank}-${i}-${j}`)), h * (0.86 + 0.14 * hashString(`h-${bank}-${i}-${j}`)), deg);
        if (roll > 0.93) buckets.strong.push(path);
        else if (roll > 0.55) buckets.mid.push(path);
        else buckets.faint.push(path);
        centers.push({ p: world, bank });
      }
    }
  });

  const avenues = [
    { x1: 6, y1: 27, x2: 94, y2: 66, width: 0.95, opacity: 0.2 },
    { x1: 29, y1: 4, x2: 67, y2: 96, width: 0.7, opacity: 0.14 },
    { x1: 4, y1: 76, x2: 96, y2: 27, width: 0.6, opacity: 0.11 },
  ];

  const pois = centers
    .filter(({ p }) => dist(p, { x: 50, y: 50 }) > 10 && dist(p, { x: 50, y: 50 }) < 43 && !STAMP_SPOTS.some((spot) => dist(p, spot) < 13))
    .map(({ p }) => ({ p, order: hashString(`poi-${p.x.toFixed(1)}-${p.y.toFixed(1)}`), k: hashString(`kind-${p.x.toFixed(1)}-${p.y.toFixed(1)}`) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 11)
    .map(({ p, k }) => ({ x: p.x, y: p.y, kind: (k < 0.5 ? "mint" : k < 0.82 ? "ember" : "amber") as PoiKind }));

  // Маршрут «от меня до скидки −55%»: пеший, по прямым участкам, как по улицам; начинается в центре — там точка «вы здесь». Кончается у якоря наклейки −55% (≈ 78, 21–24 в зависимости от размера арта) —
  // самой точки назначения у маршрута нет: её рисует сам якорь наклейки.
  const route = { d: "M50 50 L62 50 L62 37 L72 37 L77.8 24.5", end: { x: 77.8, y: 24.5 } };

  const labels = [
    { text: "НЕВА", x: 30, y: 63.2, angle: -14, size: 2.5, spacing: 1.4 },
    { text: "Невский пр.", x: 70, y: 49, angle: 23, size: 2.1, spacing: 0.5 },
    { text: "Фонтанка", x: 33, y: 22, angle: -75, size: 1.9, spacing: 0.4 },
    { text: "Летний сад", x: 23, y: 33.5, angle: 0, size: 1.9, spacing: 0.35 },
  ];

  return {
    river,
    canals,
    parks: PARKS,
    blocks: { faint: buckets.faint.join(" "), mid: buckets.mid.join(" "), strong: buckets.strong.join(" "), count: buckets.faint.length + buckets.mid.length + buckets.strong.length },
    avenues,
    pois,
    route,
    labels,
  };
}

/** Расстояние от точки до реки — для проверок и для расстановки подписей. */
export function riverDistance(p: Point): number {
  return distanceToPolyline(p, sampleRiver());
}
