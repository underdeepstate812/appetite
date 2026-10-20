import type { NearbyOffer } from "@apetite/shared";
import { getTimeLeft } from "./time";
import { sortHotFirst, sortNearestFirst } from "./offers";

/** Размеры карточки в ленте и зазор между ними: от них зависит длина «петли» бегущей ленты. */
export const RIBBON_CARD_WIDTH = 248;
export const RIBBON_CARD_HEIGHT = 84;
export const RIBBON_GAP = 10;
/** Скорость «проезда», px/с: заметно движется, но название успевает прочитаться. */
export const RIBBON_SPEED = 34;
/** Меньше стольких предложений — лента не бежит (одна и та же карточка в кадре дважды выглядела бы глупо). */
export const RIBBON_MIN_TO_DRIFT = 3;
export const RIBBON_MAX = 10;

/**
 * Что ехать по ленте над картой: предложения, у которых окно самовывоза УЖЕ открыто и товар есть; сначала ближайшие (когда
 * позиция человека известна) или горящие; разные заведения вперёд — лента не должна показывать пять карточек одной кофейни.
 */
export function ribbonOffers(offers: NearbyOffer[], now: number, nearest: boolean, max: number = RIBBON_MAX): NearbyOffer[] {
  const open = offers.filter((offer) => offer.quantityLeft > 0 && new Date(offer.pickupStart).getTime() <= now && !getTimeLeft(offer.pickupEnd, now).isPast);
  const sorted = nearest ? sortNearestFirst(open, now) : sortHotFirst(open, now);
  const seen = new Set<string>();
  const first: NearbyOffer[] = [];
  const rest: NearbyOffer[] = [];
  for (const offer of sorted) {
    if (seen.has(offer.businessId)) rest.push(offer);
    else {
      seen.add(offer.businessId);
      first.push(offer);
    }
  }
  return [...first, ...rest].slice(0, max);
}

/**
 * Геометрия бесконечной ленты: «петля» — один полный набор карточек (его ширина и есть путь, после которого картинка
 * повторяется), копий нужно столько, чтобы на любой ширине экрана справа от видимой области не оставалось пустоты.
 */
export function ribbonGeometry(count: number, viewportWidth: number): { setWidth: number; copies: number } {
  if (count <= 0) return { setWidth: 0, copies: 0 };
  const setWidth = count * (RIBBON_CARD_WIDTH + RIBBON_GAP);
  const copies = Math.max(2, Math.ceil(Math.max(0, viewportWidth) / setWidth) + 1);
  return { setWidth, copies };
}

/** Сколько миллисекунд ехать `distance` px со скоростью `speed` px/с. */
export function ribbonDurationMs(distance: number, speed: number = RIBBON_SPEED): number {
  if (!(distance > 0) || !(speed > 0)) return 0;
  return Math.round((distance / speed) * 1000);
}
