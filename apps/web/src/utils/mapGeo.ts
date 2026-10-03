/**
 * Сдвигает центр карты на (dxPx, dyPx) экранных пикселей при заданном зуме (Web Mercator, тайл 256 px).
 * Нужен, чтобы выбранный пин оказался в видимой части карты, а не под карточкой оффера:
 * dx > 0 — точка окажется правее центра, dy > 0 — выше центра. Возвращает [lng, lat] нового центра.
 */
export function shiftedCenter(lat: number, lng: number, zoom: number, dxPx: number, dyPx: number): [number, number] {
  const degPerPx = 360 / (256 * 2 ** zoom);
  return [lng - dxPx * degPerPx, lat - dyPx * degPerPx * Math.cos((lat * Math.PI) / 180)];
}
