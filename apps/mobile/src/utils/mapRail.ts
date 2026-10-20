/**
 * Геометрия и расчёты ленты компактных карточек под картой — вынесено из компонентов, чтобы проверять без экрана.
 */

export interface RailMetrics {
  /** Ширина карточки. */
  cardWidth: number;
  gap: number;
  /** Отступ ленты слева и справа: первая карточка не прижата к краю, а следующая «выглядывает». */
  inset: number;
  /** Шаг прилипания (snapToInterval): карточка + зазор. */
  snap: number;
}

const GAP = 12;
const INSET = 16;
/** Справа у экрана остаётся «выглядывающий» край следующей карточки — подсказка, что ленту можно листать. */
const PEEK = 40;
const MIN_CARD = 264;
const MAX_CARD = 344;

export function railMetrics(screenWidth: number): RailMetrics {
  const width = Number.isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 360;
  const cardWidth = Math.round(Math.min(MAX_CARD, Math.max(MIN_CARD, width - INSET - PEEK - GAP)));
  return { cardWidth, gap: GAP, inset: INSET, snap: cardWidth + GAP };
}

/** Какая карточка «встала» под палец по горизонтальному смещению ленты. */
export function indexFromOffset(offset: number, snap: number, count: number): number {
  if (count <= 0 || snap <= 0 || !Number.isFinite(offset)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offset / snap)));
}

export function offsetForIndex(index: number, snap: number): number {
  return Math.max(0, index) * snap;
}

export function indexOfOffer(offers: Array<{ id: string }>, id: string | null): number {
  if (!id) return -1;
  return offers.findIndex((offer) => offer.id === id);
}

/**
 * Куда поставить центр карты, чтобы выбранный пин оказался в середине ВИДИМОЙ части — над лентой карточек, а не под ней.
 * Видимая часть — верхние (высота − inset) px; её середина выше центра карты на inset/2, значит центр карты должен лежать
 * НИЖЕ пина на inset/2 px. latitudeDelta — высота видимой области карты в градусах широты.
 */
export function centerLatForInset(pinLat: number, latitudeDelta: number, mapHeightPx: number, insetPx: number): number {
  if (!(mapHeightPx > 0) || !(latitudeDelta > 0) || !(insetPx > 0)) return pinLat;
  return pinLat - ((insetPx / 2) / mapHeightPx) * latitudeDelta;
}
