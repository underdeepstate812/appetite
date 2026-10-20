import { mixColors } from "@apetite/shared";

/** Краски «неба» героя в данный час: всё выводится из одной таблицы ключевых часов и плавно перетекает между ними. */
export interface DayPalette {
  /** Верх-лево и низ-право фона героя. */
  skyTop: string;
  skyBottom: string;
  /** Гало вокруг диска и тон тонких колец-орбит. */
  glow: string;
  ring: string;
  /** Диск: верх и низ градиента. Днём/на закате — солнце, ночью — луна. */
  orbTop: string;
  orbBottom: string;
  /** Диск — луна (ночью): другой рисунок, без «жара». */
  moon: boolean;
  /** 0 — звёзд нет, 1 — полное небо. */
  stars: number;
  /** Высота диска над горизонтом, 0 (у кромки) … 1 (в зените): определяет, где он стоит в герое. */
  elevation: number;
  /** Подпись для скринридера/отладки. */
  name: "night" | "dawn" | "day" | "golden" | "sunset" | "dusk";
}

interface Stop {
  hour: number;
  skyTop: string;
  skyBottom: string;
  glow: string;
  ring: string;
  orbTop: string;
  orbBottom: string;
  stars: number;
}

/**
 * Ключевые часы. Фон всегда из бренд-семейства (изумрудный → тёплый), только сдвигается: ночью холоднее и глубже,
 * на рассвете и закате теплеет (ember), днём светлеет. Полночь повторяется в конце, чтобы переход был замкнутым.
 */
const STOPS: Stop[] = [
  { hour: 0, skyTop: "#071a24", skyBottom: "#0a2b33", glow: "#7fb4d6", ring: "#bfe3f2", orbTop: "#e6eef2", orbBottom: "#aebdca", stars: 1 },
  { hour: 5, skyTop: "#0a1f2b", skyBottom: "#0d2f37", glow: "#8fb7d0", ring: "#c4e2ee", orbTop: "#e1e9ee", orbBottom: "#a9b9c6", stars: 0.9 },
  { hour: 6.5, skyTop: "#0f4a4a", skyBottom: "#7a4741", glow: "#ff9d7a", ring: "#ffd9c4", orbTop: "#ffc9a8", orbBottom: "#ff8f6b", stars: 0.15 },
  { hour: 9, skyTop: "#0d6a62", skyBottom: "#0a4a46", glow: "#ffd27a", ring: "#d8fff4", orbTop: "#ffe6a0", orbBottom: "#ffb84d", stars: 0 },
  { hour: 14, skyTop: "#0d6e66", skyBottom: "#08423f", glow: "#ffd27a", ring: "#d8fff4", orbTop: "#ffe9ae", orbBottom: "#ffb347", stars: 0 },
  { hour: 17.5, skyTop: "#0c5a52", skyBottom: "#5a4a2c", glow: "#ffb35c", ring: "#ffe6c2", orbTop: "#ffcb70", orbBottom: "#ff9a3d", stars: 0 },
  { hour: 19.5, skyTop: "#123f46", skyBottom: "#7a3a2c", glow: "#ff7a45", ring: "#ffc9a8", orbTop: "#ffa05a", orbBottom: "#ff5f3a", stars: 0.2 },
  { hour: 21.5, skyTop: "#0a2a35", skyBottom: "#1f2a3a", glow: "#b57a8a", ring: "#e2c4cc", orbTop: "#ffd2b8", orbBottom: "#c98f86", stars: 0.7 },
  { hour: 24, skyTop: "#071a24", skyBottom: "#0a2b33", glow: "#7fb4d6", ring: "#bfe3f2", orbTop: "#e6eef2", orbBottom: "#aebdca", stars: 1 },
];

const SUNRISE = 5.5;
const SUNSET = 20.5;

/** Дробный локальный час 0…24 (14:30 → 14.5). */
export function hourOf(date: Date | number): number {
  const d = typeof date === "number" ? new Date(date) : date;
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** Солнце над горизонтом с 5:30 до 20:30; луна — всё остальное время. */
export function isMoonHour(hour: number): boolean {
  return hour < SUNRISE || hour >= SUNSET;
}

/** Высота диска 0…1: синус по дуге дня (солнце) или по дуге ночи (луна). Как в природе — выше всего в полдень / в полночь. */
export function orbElevation(hour: number): number {
  if (!isMoonHour(hour)) return Math.sin((Math.PI * (hour - SUNRISE)) / (SUNSET - SUNRISE));
  const sinceSunset = hour >= SUNSET ? hour - SUNSET : hour + 24 - SUNSET;
  return Math.sin((Math.PI * sinceSunset) / (24 - SUNSET + SUNRISE));
}

function phaseName(hour: number): DayPalette["name"] {
  if (hour < 5 || hour >= 22) return "night";
  if (hour < 8) return "dawn";
  if (hour < 16.5) return "day";
  if (hour < 19) return "golden";
  if (hour < 21) return "sunset";
  return "dusk";
}

/** Палитра героя для часа (0…24). Между ключевыми часами — линейный подмес в RGB: фон не «щёлкает», а течёт. */
export function dayPalette(hourInput: number): DayPalette {
  const hour = ((hourInput % 24) + 24) % 24;
  let index = STOPS.findIndex((stop, i) => i < STOPS.length - 1 && hour >= stop.hour && hour < STOPS[i + 1].hour);
  if (index < 0) index = STOPS.length - 2;
  const from = STOPS[index];
  const to = STOPS[index + 1];
  const t = (hour - from.hour) / (to.hour - from.hour);
  const moon = isMoonHour(hour);
  return {
    skyTop: mixColors(from.skyTop, to.skyTop, t),
    skyBottom: mixColors(from.skyBottom, to.skyBottom, t),
    glow: mixColors(from.glow, to.glow, t),
    ring: mixColors(from.ring, to.ring, t),
    orbTop: mixColors(from.orbTop, to.orbTop, t),
    orbBottom: mixColors(from.orbBottom, to.orbBottom, t),
    moon,
    stars: from.stars + (to.stars - from.stars) * t,
    elevation: Math.max(0, orbElevation(hour)),
    name: phaseName(hour),
  };
}
