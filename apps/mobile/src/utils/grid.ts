/**
 * Сетка карточек: не растягиваем карточку под ширину экрана, а добавляем колонки.
 * Карточка живёт в коридоре [CARD_MIN_WIDTH, CARD_MAX_WIDTH]: колонок ровно столько,
 * сколько влезает при минимальной ширине, а остаток делится между ними (при 1 колонке
 * на телефоне карточка занимает всю ширину, как и раньше).
 */
export const CARD_MIN_WIDTH = 320;
export const CARD_MAX_WIDTH = 440;
export const GRID_GAP = 10;

export interface GridLayout {
  columns: number;
  /** null — ширина ещё не измерена, карточка занимает всю строку. */
  cardWidth: number | null;
}

export function getGridLayout(containerWidth: number | null): GridLayout {
  if (containerWidth === null || containerWidth <= 0) return { columns: 1, cardWidth: null };
  const columns = Math.max(1, Math.floor((containerWidth + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)));
  const fitted = (containerWidth - GRID_GAP * (columns - 1)) / columns;
  return { columns, cardWidth: Math.floor(Math.min(fitted, CARD_MAX_WIDTH)) };
}
