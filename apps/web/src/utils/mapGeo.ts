/**
 * Сдвигает центр карты на (dxPx, dyPx) экранных пикселей при заданном зуме (Web Mercator, тайл 256 px).
 * Нужен, чтобы выбранный пин оказался в видимой части карты, а не под карточкой оффера:
 * dx > 0 — точка окажется правее центра, dy > 0 — выше центра. Возвращает [lng, lat] нового центра.
 */
export function shiftedCenter(lat: number, lng: number, zoom: number, dxPx: number, dyPx: number): [number, number] {
  const degPerPx = 360 / (256 * 2 ** zoom);
  return [lng - dxPx * degPerPx, lat - dyPx * degPerPx * Math.cos((lat * Math.PI) / 180)];
}

/** Прямоугольник шторки предложения в координатах контейнера карты (нужны только левый/правый/верхний края). */
export interface SheetBox {
  left: number;
  right: number;
  top: number;
}

/** Высота метки с фото вместе с хвостиком: центрируем в свободной полосе именно её, а не одно остриё. */
const PIN_GLYPH_HEIGHT = 58;

/**
 * Куда сместить центр карты, чтобы выбранная метка встала в СЕРЕДИНУ части, не закрытой шторкой предложения.
 * Шторка слева (широкая карта) — метка правее центра на dx; шторка снизу (телефон) — метка выше центра на dy.
 * Размер берём с живой шторки: у предложений с длинным составом она выше, чем «в среднем», и фиксированный
 * процент прятал метку под неё. Без шторки сдвиг нулевой.
 */
export function offsetFromSheet(width: number, height: number, sheet: SheetBox | null): { dx: number; dy: number } {
  if (!sheet) return { dx: 0, dy: 0 };
  if (width > 700) {
    return { dx: Math.max(0, (sheet.right + width) / 2 - width / 2), dy: 0 };
  }
  // Центр метки — не выше 40 px от верха карты, иначе она упрётся в край.
  const stripCenter = Math.max(sheet.top / 2, PIN_GLYPH_HEIGHT / 2 + 12);
  const tipY = stripCenter + PIN_GLYPH_HEIGHT / 2;
  return { dx: 0, dy: Math.max(0, height / 2 - tipY) };
}

/** Шторка предложения, лежащая в той же карточке-сцене (`.map-stage`), что и контейнер карты. */
export function readSheetBox(container: HTMLElement): SheetBox | null {
  const sheet = container.closest(".map-stage")?.querySelector<HTMLElement>(".offer-sheet");
  if (!sheet) return null;
  const area = container.getBoundingClientRect();
  const box = sheet.getBoundingClientRect();
  return { left: box.left - area.left, right: box.right - area.left, top: box.top - area.top };
}
