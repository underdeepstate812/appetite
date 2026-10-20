/** Порог закрытия свайпом: протащили дальше DISMISS_DISTANCE пикселей или отпустили на скорости (как в Drawer/vaul, 21st.dev). */
export const DISMISS_DISTANCE = 110;
export const DISMISS_VELOCITY = 0.8;

/**
 * Закрывать ли шторку, когда палец отпустили. dy — сколько протащили вниз (px), vy — скорость вниз (px/мс).
 * Быстрый щелчок вниз закрывает и при малом пути, но не при случайном касании (dy < 20).
 */
export function shouldDismissSheet(dy: number, vy: number): boolean {
  if (dy >= DISMISS_DISTANCE) return true;
  return vy >= DISMISS_VELOCITY && dy >= 20;
}

/** Тянуть вверх можно, но с сопротивлением (резинка): шторка не должна уезжать от края. Вниз — один в один. */
export function dragOffset(dy: number): number {
  return dy >= 0 ? dy : dy * 0.12;
}
