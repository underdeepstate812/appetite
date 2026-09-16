export interface EcoLevel {
  id: number;
  minPoints: number;
  icon: string;
}

/** Пороги уровней эко-профиля — названия/переводы на стороне клиента (i18n), тут только данные. */
export const ECO_LEVELS: EcoLevel[] = [
  { id: 1, minPoints: 0, icon: "🌱" },
  { id: 2, minPoints: 50, icon: "🥡" },
  { id: 3, minPoints: 200, icon: "🌍" },
  { id: 4, minPoints: 500, icon: "🏆" },
];

export function getEcoLevel(points: number): EcoLevel {
  let current = ECO_LEVELS[0];
  for (const level of ECO_LEVELS) {
    if (points >= level.minPoints) current = level;
  }
  return current;
}

export function getNextEcoLevel(points: number): EcoLevel | null {
  const current = getEcoLevel(points);
  const index = ECO_LEVELS.findIndex((level) => level.id === current.id);
  return ECO_LEVELS[index + 1] ?? null;
}

export interface EcoSummary {
  totalPoints: number;
  totalWeightSavedKg: number;
  ordersCompleted: number;
  level: EcoLevel;
  nextLevel: EcoLevel | null;
}
