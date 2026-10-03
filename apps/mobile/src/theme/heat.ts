/**
 * Шкала "жара" вынесена в @apetite/shared (общая для mobile и web — маркеры на карте
 * теперь красятся тем же временем, что и карточки/фитили в приложении). Реэкспорт
 * сохраняет старый путь импорта ("../theme/heat"), которым пользуются существующие
 * компоненты (OfferCard, FuseTimer, DiscountStamp, OrderStatusTimeline и т.д.).
 */
export { mixColors, heatBand, heatColor, heatInk, heatTint, heatStops } from "@apetite/shared";
export type { ThemeMode } from "@apetite/shared";
